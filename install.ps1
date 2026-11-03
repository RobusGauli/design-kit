# design-kit installer for Windows (PowerShell 5.1+).
#
#   irm https://raw.githubusercontent.com/RobusGauli/design-kit/main/install.ps1 | iex
#
# Same contract as install.sh: copies skills/design-system and skills/prototype of the latest
# release to %LOCALAPPDATA%\design-kit\skills\, then links each into ~\.claude\skills and
# ~\.agents\skills (and ~\.cursor\skills, ~\.kiro\skills when present) as directory junctions,
# so no admin rights are needed. Never replaces a file or link it did not create.
# Pin a version with $env:DESIGN_KIT_REF = "v0.1.0". Output ends with `done.`.

& {
  $ErrorActionPreference = "Stop"
  $Repo = "RobusGauli/design-kit"
  $Skills = @("design-system", "prototype")
  $Data = Join-Path $env:LOCALAPPDATA "design-kit"
  $SkillsDir = Join-Path $Data "skills"
  New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null
  $Stage = Join-Path $Data (".stage." + [guid]::NewGuid().ToString("N").Substring(0, 8))
  New-Item -ItemType Directory -Path $Stage | Out-Null
  try {
    if ($env:DESIGN_KIT_SOURCE) {
      $Src = $env:DESIGN_KIT_SOURCE; $Source = "local:$Src"
    } else {
      $Ref = $env:DESIGN_KIT_REF
      if (-not $Ref) {
        $req = [System.Net.WebRequest]::Create("https://github.com/$Repo/releases/latest")
        $req.AllowAutoRedirect = $false
        $loc = $req.GetResponse().Headers["Location"]
        if ($loc -notmatch '/releases/tag/([A-Za-z0-9._-]+)$') { throw "could not find the latest design-kit release." }
        $Ref = $Matches[1]
      }
      $zip = Join-Path $Stage "src.zip"
      Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/$Repo/zip/$Ref" -OutFile $zip
      Expand-Archive $zip -DestinationPath (Join-Path $Stage "src")
      $Src = (Get-ChildItem (Join-Path $Stage "src") -Directory | Select-Object -First 1).FullName
      $Source = "$Repo@$Ref"
    }
    foreach ($s in $Skills) {
      if (-not (Test-Path (Join-Path $Src "skills\$s\SKILL.md"))) { throw "$Src has no skills\$s\SKILL.md." }
    }
    $Version = "unknown"
    if (Test-Path (Join-Path $Src "VERSION")) { $Version = (Get-Content (Join-Path $Src "VERSION") -Raw).Trim() }

    foreach ($s in $Skills) {
      $dest = Join-Path $SkillsDir $s
      if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
      Copy-Item -Recurse (Join-Path $Src "skills\$s") $dest
      Write-Output "installed: $dest"
    }
    @{ version = $Version; source = $Source; installed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") } |
      ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Data "install.json")

    $roots = @("$HOME\.claude\skills", "$HOME\.agents\skills")
    if (Test-Path "$HOME\.cursor") { $roots += "$HOME\.cursor\skills" }
    if (Test-Path "$HOME\.kiro") { $roots += "$HOME\.kiro\skills" }
    foreach ($s in $Skills) {
      $target = Join-Path $SkillsDir $s
      foreach ($r in $roots) {
        $p = Join-Path $r $s
        $item = Get-Item $p -Force -ErrorAction SilentlyContinue
        if ($item -and $item.LinkType -and ("$($item.Target)" -like "*\design-kit\skills\*")) {
          $item.Delete()
        } elseif ($item) {
          Write-Output "skipped:   $p (already exists and is not design-kit's; left it alone)"; continue
        }
        New-Item -ItemType Directory -Force -Path $r | Out-Null
        New-Item -ItemType Junction -Path $p -Target $target | Out-Null
        Write-Output "linked:    $p"
      }
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue) -and -not (Get-Command bun -ErrorAction SilentlyContinue)) {
      Write-Output "warning:   neither node (18+) nor bun is on PATH; the design scripts need one of them."
    }
    Write-Output "skills:    $SkillsDir"
    Write-Output "version:   $Version"
    Write-Output "source:    $Source"
    Write-Output "done."
  } finally {
    Remove-Item -Recurse -Force $Stage -ErrorAction SilentlyContinue
  }
}
