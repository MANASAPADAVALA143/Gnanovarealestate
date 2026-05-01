# PowerShell script to test property search API
# Usage: .\scripts\test-property-search.ps1

$baseUrl = "http://localhost:3000"

Write-Host "🔍 Testing Property Search API..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Basic search
Write-Host "Test 1: Basic search for Miami properties" -ForegroundColor Yellow
$body = @{
    query = "Miami"
    maxPrice = 500000
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/properties/search" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Results: $($response.resultsCount)" -ForegroundColor Green
    if ($response.properties) {
        $response.properties | ForEach-Object {
            Write-Host "  - $($_.address), $($_.city) - $($_.price)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Test 2: Search with filters" -ForegroundColor Yellow
$body2 = @{
    query = "3 bedroom house"
    maxPrice = 500000
    minBeds = 3
    location = "Miami"
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/api/properties/search" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body2
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Results: $($response2.resultsCount)" -ForegroundColor Green
    if ($response2.properties) {
        $response2.properties | ForEach-Object {
            Write-Host "  - $($_.address), $($_.city) - $($_.price) - $($_.bedrooms) bed" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Testing complete!" -ForegroundColor Cyan
