@echo off
REM Database Backup and Recovery Script for Online Quiz Maker (Windows)
REM This script handles automated backups of your Supabase database

setlocal enabledelayedexpansion

REM Configuration
set SUPABASE_PROJECT_REF=%SUPABASE_PROJECT_REF%
set SUPABASE_API_KEY=%SUPABASE_API_KEY%
set BACKUP_DIR=backups
set TIMESTAMP=%date:~-4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_FILE=!BACKUP_DIR!\quiz_maker_!TIMESTAMP!.sql

REM Create backup directory if it doesn't exist
if not exist "!BACKUP_DIR!" (
    mkdir "!BACKUP_DIR!"
    echo [INFO] Created backup directory: !BACKUP_DIR!
)

REM Check requirements
if "!SUPABASE_PROJECT_REF!"=="" (
    echo [ERROR] SUPABASE_PROJECT_REF environment variable not set
    echo Set it with: setx SUPABASE_PROJECT_REF your_project_ref
    exit /b 1
)

if "!SUPABASE_API_KEY!"=="" (
    echo [ERROR] SUPABASE_API_KEY environment variable not set
    echo Set it with: setx SUPABASE_API_KEY your_api_key
    exit /b 1
)

REM Perform backup
echo [INFO] Starting database backup...

REM Export quizzes table
echo [INFO] Exporting quizzes table...
curl -s ^
    -H "apikey: !SUPABASE_API_KEY!" ^
    -H "Authorization: Bearer !SUPABASE_API_KEY!" ^
    "https://!SUPABASE_PROJECT_REF!.supabase.co/rest/v1/quizzes?select=*" ^
    -o "!BACKUP_DIR!\quizzes_!TIMESTAMP!.json"

REM Export questions table
echo [INFO] Exporting questions table...
curl -s ^
    -H "apikey: !SUPABASE_API_KEY!" ^
    -H "Authorization: Bearer !SUPABASE_API_KEY!" ^
    "https://!SUPABASE_PROJECT_REF!.supabase.co/rest/v1/questions?select=*" ^
    -o "!BACKUP_DIR!\questions_!TIMESTAMP!.json"

REM Export quiz_attempts table
echo [INFO] Exporting quiz_attempts table...
curl -s ^
    -H "apikey: !SUPABASE_API_KEY!" ^
    -H "Authorization: Bearer !SUPABASE_API_KEY!" ^
    "https://!SUPABASE_PROJECT_REF!.supabase.co/rest/v1/quiz_attempts?select=*" ^
    -o "!BACKUP_DIR!\quiz_attempts_!TIMESTAMP!.json"

echo [INFO] Backup completed: !BACKUP_FILE!
echo [INFO] Backup process completed successfully

endlocal
