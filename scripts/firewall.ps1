# Lets the phone reach this computer while install-without-usb.bat shares the app over Wi-Fi.
#   firewall.ps1 -Check   exit 0 if already set up, 1 if not (no admin rights needed)
#   firewall.ps1          set it up (needs admin rights; the .bat asks Windows for them)
# It allows incoming connections on the one port the installer uses (8737), and removes "block"
# rules Windows creates for Node.js when its "allow access?" popup is dismissed, since a block rule
# would override the allow rule.
param([switch]$Check)
$ErrorActionPreference = 'SilentlyContinue'
$ruleName = 'Workout app install (port 8737)'

$allow = Get-NetFirewallRule -DisplayName $ruleName
$nodeBlocks = Get-NetFirewallRule -Direction Inbound -Action Block |
  Where-Object { $_.DisplayName -like 'Node.js*' -or $_.DisplayName -like 'node*' }

if ($Check) {
  if ($allow -and -not $nodeBlocks) { exit 0 } else { exit 1 }
}

if ($nodeBlocks) { $nodeBlocks | Remove-NetFirewallRule }
if (-not $allow) {
  New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8737 -Profile Any | Out-Null
}
exit 0
