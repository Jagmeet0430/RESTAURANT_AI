#define MyAppName "RestaurantAI"
#define MyAppPublisher "RestaurantAI"
#define MyAppVersion "1.4.7"
#define MyAppId "{{9A7811B0-8392-4C65-8A3E-5D7F9F86E35A}"
#define SourceRoot "..\dist\RestaurantAI-Windows"
#define StateRoot "{commonappdata}\RestaurantAI"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\RestaurantAI
UsePreviousAppDir=yes
DefaultGroupName=RestaurantAI
DisableProgramGroupPage=no
OutputDir=..\dist\installer
OutputBaseFilename=RestaurantAI-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupLogging=yes
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checkedonce
Name: "firewall"; Description: "Allow RestaurantAI on this private network"; GroupDescription: "Post-install actions:"; Flags: unchecked
Name: "autostart"; Description: "Start RestaurantAI backend at Windows boot (SYSTEM)"; GroupDescription: "Post-install actions:"; Flags: unchecked
Name: "kiosklogin"; Description: "Open customer kiosk after Windows login"; GroupDescription: "Post-install actions:"; Flags: unchecked
Name: "startnow"; Description: "Start RestaurantAI and open Admin"; GroupDescription: "Post-install actions:"; Flags: checkedonce

[Dirs]
Name: "{#StateRoot}"; Flags: uninsneveruninstall
Name: "{#StateRoot}\config"; Flags: uninsneveruninstall
Name: "{#StateRoot}\data"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{#StateRoot}\backups"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{#StateRoot}\backups\database"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{#StateRoot}\backups\logs"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{#StateRoot}\logs"; Permissions: users-modify; Flags: uninsneveruninstall
Name: "{#StateRoot}\runtime"; Permissions: users-modify; Flags: uninsneveruninstall

[Files]
Source: "{#SourceRoot}\scripts\check-installer.ps1"; Flags: dontcopy
Source: "{#SourceRoot}\scripts\backup-restaurantai.ps1"; Flags: dontcopy
Source: "{#SourceRoot}\scripts\stop-restaurantai.ps1"; Flags: dontcopy
Source: "{#SourceRoot}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\docs\*"; DestDir: "{app}\docs"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\package-manifest.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\config\.env.example"; DestDir: "{#StateRoot}\config"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall
Source: "{#SourceRoot}\config\printer.example.json"; DestDir: "{#StateRoot}\config"; Flags: onlyifdoesntexist uninsneveruninstall

[Icons]
Name: "{group}\RestaurantAI"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\start-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"" -OpenBrowser"; WorkingDir: "{app}"
Name: "{group}\RestaurantAI Admin"; Filename: "{sys}\cmd.exe"; Parameters: "/C start """" ""http://127.0.0.1:5001/admin"""; WorkingDir: "{app}"
Name: "{group}\RestaurantAI POS"; Filename: "{sys}\cmd.exe"; Parameters: "/C start """" ""http://127.0.0.1:5001/admin/barcode-pos"""; WorkingDir: "{app}"
Name: "{group}\RestaurantAI Kitchen"; Filename: "{sys}\cmd.exe"; Parameters: "/C start """" ""http://127.0.0.1:5001/admin/kitchen"""; WorkingDir: "{app}"
Name: "{group}\Start Customer Kiosk"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-customer-kiosk.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; WorkingDir: "{app}"
Name: "{group}\Close Customer Kiosk"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\stop-customer-kiosk.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; WorkingDir: "{app}"
Name: "{group}\RestaurantAI Backup"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\backup-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; WorkingDir: "{app}"
Name: "{group}\RestaurantAI Documentation"; Filename: "{app}\docs\WINDOWS_DEPLOYMENT.md"
Name: "{autodesktop}\RestaurantAI"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\start-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"" -OpenBrowser"; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autodesktop}\Start Customer Kiosk"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\start-customer-kiosk.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{autodesktop}\Close Customer Kiosk"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\scripts\stop-customer-kiosk.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; WorkingDir: "{app}"; Tasks: desktopicon

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\stop-customer-kiosk.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; Flags: runhidden waituntilterminated; RunOnceId: "RestaurantAI_Stop_Customer_Kiosk"
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\stop-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; Flags: runhidden waituntilterminated; RunOnceId: "RestaurantAI_Stop_Server"
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\remove-kiosk-autostart.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "RestaurantAI_Remove_Kiosk_Startup_Task"
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-startup-task.ps1"" -Action Remove -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; Flags: runhidden waituntilterminated; RunOnceId: "RestaurantAI_Remove_Startup_Task"
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-firewall.ps1"" -Action Remove -Port 5001"; Flags: runhidden waituntilterminated; RunOnceId: "RestaurantAI_Remove_Firewall"

[Code]
function RunHidden(FileName: String; Parameters: String; var ResultCode: Integer): Boolean;
begin
  Result := Exec(FileName, Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

function PowerShellPath(): String;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;

function ExistingInstall(): Boolean;
begin
  Result :=
    FileExists(ExpandConstant('{commonappdata}\RestaurantAI\config\.env')) or
    DirExists(ExpandConstant('{app}\app\backend'));
end;

function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;

  if not IsWin64 then begin
    MsgBox('RestaurantAI requires 64-bit Windows.', mbError, MB_OK);
    Result := False;
    exit;
  end;

  ExtractTemporaryFile('check-installer.ps1');
  if (not RunHidden(PowerShellPath(), '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\check-installer.ps1') + '" -TargetVersion "{#MyAppVersion}"', ResultCode)) or (ResultCode <> 0) then begin
    MsgBox('Prerequisites/version check failed. Do not downgrade an installed release. Node.js 22+ x64 and PostgreSQL 18+ tools are required. Nothing has been installed. Run check-installer.ps1 manually for details; see docs/CUSTOMER_INSTALLATION.md.', mbError, MB_OK);
    Result := False;
  end;
end;

procedure RunCheckedScript(ScriptPath: String; Extra: String; Visible: Boolean);
var
  Code: Integer;
  Show: Integer;
begin
  Show := SW_HIDE;
  if Visible then Show := SW_SHOWNORMAL;
  if (not Exec(PowerShellPath(), '-NoProfile -ExecutionPolicy Bypass -File "' + ScriptPath + '" ' + Extra, '', Show, ewWaitUntilTerminated, Code)) or (Code <> 0) then
    RaiseException('RestaurantAI setup step failed: ' + ExtractFileName(ScriptPath) + '. Installation is NOT operational. Existing business data is retained; see ProgramData\RestaurantAI\logs and the technician guide.');
end;

function InstallArguments(): String;
begin
  Result := '-InstallRoot "' + ExpandConstant('{app}') + '" -StateRoot "' + ExpandConstant('{#StateRoot}') + '"';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Parameters: String;
begin
  if CurStep = ssInstall then begin
    if ExistingInstall() and not FileExists(ExpandConstant('{#StateRoot}\config\.env')) then
      RaiseException('Existing installation has no configuration. Recover its configuration before upgrading; no backup can be verified.');
    if FileExists(ExpandConstant('{app}\scripts\stop-customer-kiosk.ps1')) then begin
      Parameters := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\stop-customer-kiosk.ps1') + '" -InstallRoot "' + ExpandConstant('{app}') + '" -StateRoot "' + ExpandConstant('{commonappdata}\RestaurantAI') + '"';
      if (not RunHidden(PowerShellPath(), Parameters, ResultCode)) or (ResultCode <> 0) then
        RaiseException('Cannot stop customer kiosk. Upgrade aborted before replacement.');
    end;

    if FileExists(ExpandConstant('{app}\scripts\stop-restaurantai.ps1')) then begin
      ExtractTemporaryFile('stop-restaurantai.ps1');
      Parameters := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\stop-restaurantai.ps1') + '" -InstallRoot "' + ExpandConstant('{app}') + '" -StateRoot "' + ExpandConstant('{commonappdata}\RestaurantAI') + '"';
      if (not RunHidden(PowerShellPath(), Parameters, ResultCode)) or (ResultCode <> 0) then
        RaiseException('Cannot stop backend. Upgrade aborted before replacement.');
    end;

    if ExistingInstall() then begin
      RunCheckedScript(ExpandConstant('{tmp}\check-installer.ps1'), InstallArguments() + ' -CheckStopped', False);
      ExtractTemporaryFile('backup-restaurantai.ps1');
      RunCheckedScript(ExpandConstant('{tmp}\backup-restaurantai.ps1'), InstallArguments(), False);
    end;
  end;

  if CurStep = ssPostInstall then begin
    if (not RunHidden(ExpandConstant('{sys}\icacls.exe'), '"' + ExpandConstant('{#StateRoot}\config') + '" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)(F)" "*S-1-5-32-544:(OI)(CI)(F)" "*S-1-5-32-545:(OI)(CI)(RX)"', ResultCode)) or (ResultCode <> 0) then
      RaiseException('Configuration permissions could not be secured.');
    if not FileExists(ExpandConstant('{#StateRoot}\config\.env')) then begin
      if WizardSilent() then RaiseException('Fresh silent installation requires pre-provisioned local configuration. Use interactive Setup first.');
      RunCheckedScript(ExpandConstant('{app}\scripts\setup-restaurantai.ps1'), InstallArguments(), True);
    end;

    RunCheckedScript(ExpandConstant('{app}\scripts\prepare-installed-database.ps1'), InstallArguments(), False);
    RunCheckedScript(ExpandConstant('{app}\scripts\start-restaurantai.ps1'), InstallArguments(), False);
    if WizardIsTaskSelected('firewall') then
      RunCheckedScript(ExpandConstant('{app}\scripts\configure-firewall.ps1'), '-Action Add -Port 5001', False);
    if WizardIsTaskSelected('autostart') then
      RunCheckedScript(ExpandConstant('{app}\scripts\install-startup-task.ps1'), InstallArguments(), False);
    if WizardIsTaskSelected('kiosklogin') then
      RunCheckedScript(ExpandConstant('{app}\scripts\install-kiosk-autostart.ps1'), InstallArguments(), False);
    if not WizardIsTaskSelected('startnow') then
      RunCheckedScript(ExpandConstant('{app}\scripts\stop-restaurantai.ps1'), InstallArguments(), False)
    else if not WizardSilent() then
      ShellExec('open', 'http://127.0.0.1:5001/admin', '', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
  end;
end;

