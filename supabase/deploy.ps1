#!/usr/bin/env pwsh
# ============================================================
# DEPLOY EDGE FUNCTIONS TO SUPABASE
# ------------------------------------------------------------
# Prerequisites:
#   1. Get your access token from:  https://supabase.com/dashboard/account/tokens
#   2. Set it below or as env var:  $env:SUPABASE_ACCESS_TOKEN = "your_token"
# ============================================================

$PROJECT_REF = "ziiwbevepzfibdhkkthk"

# --- Set your access token here ---
# $env:SUPABASE_ACCESS_TOKEN = "sbp_your_token_here"

Write-Host "Linking project..." -ForegroundColor Cyan
npx supabase link --project-ref $PROJECT_REF

Write-Host "`nSetting Cashfree secrets..." -ForegroundColor Cyan
npx supabase secrets set `
    CASHFREE_APP_ID=$env:CASHFREE_APP_ID `
    CASHFREE_SECRET_KEY=$env:CASHFREE_SECRET_KEY `
    --project-ref $PROJECT_REF

Write-Host "`nDeploying create-cashfree-order..." -ForegroundColor Cyan
npx supabase functions deploy create-cashfree-order --project-ref $PROJECT_REF --no-verify-jwt

Write-Host "`nDeploying cashfree-webhook..." -ForegroundColor Cyan
npx supabase functions deploy cashfree-webhook --project-ref $PROJECT_REF --no-verify-jwt

Write-Host "`nAll done! Functions deployed:" -ForegroundColor Green
Write-Host "  https://$PROJECT_REF.supabase.co/functions/v1/create-cashfree-order"
Write-Host "  https://$PROJECT_REF.supabase.co/functions/v1/cashfree-webhook"
