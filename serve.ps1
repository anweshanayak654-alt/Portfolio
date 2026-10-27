# ==============================================================================
# Local Development Server with Static File Hosting & Chatbot API Proxy
# ==============================================================================
$port = 3000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "Portfolio development server running at: http://localhost:$port/" -ForegroundColor Green
Write-Host "Chatbot API route active at: http://localhost:$port/api/chat" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Cyan

$SYSTEM_PROMPT = "You are a helpful portfolio assistant for Anwesha Nayak, a B.Tech Computer Science student at JECRC University, Jaipur (graduation 2029). Speak briefly about her skills (Python, JavaScript, HTML5, CSS3, Git, GitHub, Vercel, REST APIs, Cursor AI), projects, and career interests. Do not invent employers or awards. If asked for contact, share that visitors can use the Contact section of the site."

function Get-ChatbotApiKey {
    # 1. Check system environment
    if (![string]::IsNullOrWhiteSpace($env:CHATBOT_API_KEY) -and $env:CHATBOT_API_KEY -ne "your_key_here") {
        return $env:CHATBOT_API_KEY.Trim()
    }

    # 2. Check candidate .env files
    $candidateFiles = @(
        (Join-Path $PSScriptRoot ".env.local"),
        (Join-Path $PSScriptRoot ".env"),
        (Join-Path (Split-Path -Parent $PSScriptRoot) ".env.local"),
        (Join-Path (Split-Path -Parent $PSScriptRoot) ".env")
    )

    foreach ($file in $candidateFiles) {
        if (Test-Path $file) {
            $lines = Get-Content -Path $file -ErrorAction SilentlyContinue
            foreach ($line in $lines) {
                $trimmed = $line.Trim()
                if ($trimmed -and !$trimmed.StartsWith("#") -and $trimmed.Contains("=")) {
                    $parts = $trimmed -split "=", 2
                    if ($parts[0].Trim() -eq "CHATBOT_API_KEY") {
                        $val = $parts[1].Trim().Trim("`"'")
                        if (![string]::IsNullOrWhiteSpace($val) -and $val -ne "your_key_here") {
                            return $val
                        }
                    }
                }
            }
        }
    }

    return $null
}

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response
            
            $path = $request.Url.LocalPath

            # ------------------------------------------------------------------
            # 1. Chatbot API Route: /api/chat
            # ------------------------------------------------------------------
            if ($path -eq "/api/chat" -or $path -eq "/api/chat/") {
                $response.AddHeader("Access-Control-Allow-Origin", "*")
                $response.AddHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
                $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")

                if ($request.HttpMethod -eq "OPTIONS") {
                    $response.StatusCode = 204
                    $response.OutputStream.Close()
                    continue
                }

                if ($request.HttpMethod -ne "POST") {
                    $response.StatusCode = 405
                    $response.ContentType = "application/json; charset=utf-8"
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Method not allowed"}')
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                # Check for API key
                $apiKey = Get-ChatbotApiKey
                if ([string]::IsNullOrWhiteSpace($apiKey)) {
                    $response.StatusCode = 500
                    $response.ContentType = "application/json; charset=utf-8"
                    $errObj = @{
                        error = "CHATBOT_API_KEY is not configured. Please add your real OpenAI API key to .env.local in portfolio-project/"
                    }
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes(($errObj | ConvertTo-Json -Compress))
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                # Read request body
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $bodyText = $reader.ReadToEnd()
                $reader.Close()

                $bodyJson = $null
                try {
                    $bodyJson = $bodyText | ConvertFrom-Json
                } catch {
                    $response.StatusCode = 400
                    $response.ContentType = "application/json; charset=utf-8"
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Invalid JSON payload"}')
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                if (!$bodyJson.messages -or !($bodyJson.messages -is [System.Collections.IEnumerable])) {
                    $response.StatusCode = 400
                    $response.ContentType = "application/json; charset=utf-8"
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"messages array is required"}')
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    $response.OutputStream.Close()
                    continue
                }

                # Build messages array with system prompt
                $chatMessages = @(
                    @{ role = "system"; content = $SYSTEM_PROMPT }
                )

                foreach ($m in $bodyJson.messages) {
                    if ($m.role -and $m.content) {
                        $contentStr = [string]$m.content
                        if ($contentStr.Length -gt 4000) { $contentStr = $contentStr.Substring(0, 4000) }
                        $chatMessages += @{ role = [string]$m.role; content = $contentStr }
                    }
                }

                # Make upstream request to OpenAI
                $openaiPayload = @{
                    model = "gpt-4o-mini"
                    temperature = 0.4
                    max_tokens = 400
                    messages = $chatMessages
                } | ConvertTo-Json -Depth 5

                try {
                    $openAiResponse = Invoke-RestMethod -Uri "https://api.openai.com/v1/chat/completions" `
                        -Method Post `
                        -Headers @{
                            "Content-Type"  = "application/json"
                            "Authorization" = "Bearer $apiKey"
                        } `
                        -Body $openaiPayload `
                        -ErrorAction Stop

                    $replyText = $openAiResponse.choices[0].message.content
                    $replyObj = @{ reply = [string]$replyText }

                    $response.StatusCode = 200
                    $response.ContentType = "application/json; charset=utf-8"
                    $replyBytes = [System.Text.Encoding]::UTF8.GetBytes(($replyObj | ConvertTo-Json -Compress))
                    $response.OutputStream.Write($replyBytes, 0, $replyBytes.Length)
                    $response.OutputStream.Close()
                } catch {
                    $errMessage = "OpenAI API call failed"
                    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
                        try {
                            $errJson = $_.ErrorDetails.Message | ConvertFrom-Json
                            if ($errJson.error -and $errJson.error.message) {
                                $errMessage = $errJson.error.message
                            }
                        } catch {
                            $errMessage = $_.ErrorDetails.Message
                        }
                    } elseif ($_.Exception) {
                        $errMessage = $_.Exception.Message
                    }

                    $response.StatusCode = 502
                    $response.ContentType = "application/json; charset=utf-8"
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes((@{ error = $errMessage } | ConvertTo-Json -Compress))
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    $response.OutputStream.Close()
                }

                continue
            }

            # ------------------------------------------------------------------
            # 2. Static File Serving
            # ------------------------------------------------------------------
            if ($path -eq "/" -or [string]::IsNullOrWhiteSpace($path)) { 
                $path = "/index.html" 
            }
            
            $cleanPath = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
            $localPath = Join-Path $PSScriptRoot $cleanPath
            
            if (Test-Path $localPath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($localPath)
                $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
                $contentType = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".svg"  { "image/svg+xml" }
                    ".jpg"  { "image/jpeg" }
                    ".jpeg" { "image/jpeg" }
                    ".png"  { "image/png" }
                    default { "application/octet-stream" }
                }
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.OutputStream.Write($msg, 0, $msg.Length)
            }
            $response.OutputStream.Close()
        } catch {
            # Catch transient socket disconnects and continue listening
        }
    }
} finally {
    $listener.Stop()
}
