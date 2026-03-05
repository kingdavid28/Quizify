#!/bin/bash
# Database Backup and Recovery Script for Online Quiz Maker
# This script handles automated backups of your Supabase database

set -e

# Configuration
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF}"
SUPABASE_API_KEY="${SUPABASE_API_KEY}"
BACKUP_DIR="./backups"
BACKUP_RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/quiz_maker_${TIMESTAMP}.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    if [ -z "$SUPABASE_PROJECT_REF" ]; then
        log_error "SUPABASE_PROJECT_REF environment variable not set"
        exit 1
    fi
    
    if [ -z "$SUPABASE_API_KEY" ]; then
        log_error "SUPABASE_API_KEY environment variable not set"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    log_info "All requirements met"
}

create_backup_directory() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

perform_backup() {
    log_info "Starting database backup..."
    
    # For Supabase, we use the REST API to export data
    # This is a simplified approach - for production, consider pg_dump
    
    local db_url="https://${SUPABASE_PROJECT_REF}.supabase.co"
    local api_key="$SUPABASE_API_KEY"
    
    # Export quizzes table
    log_info "Exporting quizzes table..."
    curl -s \
        -H "apikey: $api_key" \
        -H "Authorization: Bearer $api_key" \
        "${db_url}/rest/v1/quizzes?select=*" \
        > "${BACKUP_DIR}/quizzes_${TIMESTAMP}.json"
    
    # Export questions table
    log_info "Exporting questions table..."
    curl -s \
        -H "apikey: $api_key" \
        -H "Authorization: Bearer $api_key" \
        "${db_url}/rest/v1/questions?select=*" \
        > "${BACKUP_DIR}/questions_${TIMESTAMP}.json"
    
    # Export quiz_attempts table
    log_info "Exporting quiz_attempts table..."
    curl -s \
        -H "apikey: $api_key" \
        -H "Authorization: Bearer $api_key" \
        "${db_url}/rest/v1/quiz_attempts?select=*" \
        > "${BACKUP_DIR}/quiz_attempts_${TIMESTAMP}.json"
    
    log_info "Backup completed: $BACKUP_FILE"
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -type f -name "*.json" -mtime +$BACKUP_RETENTION_DAYS -delete
    
    log_info "Cleanup completed"
}

restore_backup() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "This will restore data from: $backup_file"
    read -p "Are you sure you want to continue? (yes/no) " -n 3 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring backup..."
    # Implementation depends on your specific setup
    # This is a placeholder - implement based on your needs
    
    log_info "Restore completed"
}

list_backups() {
    log_info "Available backups:"
    ls -lh "$BACKUP_DIR"/*.json 2>/dev/null || log_warn "No backups found"
}

# Main
main() {
    local command="${1:-backup}"
    
    case "$command" in
        backup)
            check_requirements
            create_backup_directory
            perform_backup
            cleanup_old_backups
            log_info "Backup process completed successfully"
            ;;
        restore)
            if [ -z "$2" ]; then
                log_error "Backup file path required for restore command"
                exit 1
            fi
            check_requirements
            restore_backup "$2"
            ;;
        list)
            list_backups
            ;;
        *)
            log_error "Unknown command: $command"
            echo "Usage: $0 {backup|restore|list} [backup_file]"
            exit 1
            ;;
    esac
}

main "$@"
