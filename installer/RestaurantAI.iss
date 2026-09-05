#define MyAppName "RestaurantAI"
#define MyAppPublisher "RestaurantAI"
#define MyAppVersion "1.0.1"
#define MyAppId "{{9A7811B0-8392-4C65-8A3E-5D7F9F86E35A}"
#define SourceRoot "..\dist\RestaurantAI-Windows"
#define StateRoot "{commonappdata}\RestaurantAI"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\RestaurantAI
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
Name: "configure"; Description: "Configure RestaurantAI now"; GroupDescription: "Post-install actions:"; Flags: checkedonce
Name: "firewall"; Description: "Allow RestaurantAI on this private network"; GroupDescription: "Post-install actions:"; Flags: unchecked
Name: "autostart"; Description: "Start RestaurantAI automatically when Windows starts"; GroupDescription: "Post-install actions:"; Flags: unchecked
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
Source: "{#SourceRoot}\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\docs\*"; DestDir: "{app}\docs"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\package-manifest.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\config\.env.example"; DestDir: "{#StateRoot}\config"; Flags: ignoreversion onlyifdoesntexist uninsneveruninstall

[Icons]
Name: "{group}\RestaurantAI"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\start-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"" -OpenBrowser"; WorkingDir: "{app}"
Name: "{group}\RestaurantAI Admin"; Filename: "{sys}\cmd.exe"; Parameters: "/C start """" ""http://localhost:5001/admin"""; WorkingDir: "{app}"
Name: "{group}\RestaurantAI POS"; Filename: "{sys}\cmd.exe"; Parameters: "/C start """" ""http://localhost:5001/admin/barcode-pos"""; WorkingDir: "{app}"
Name: "{group}\RestaurantAI Kitchen"; Filename: "{sys}\cmd.exe"; Parameters: "/C start """" ""http://localhost:5001/admin/kitchen"""; WorkingDir: "{app}"
Name: "{group}\RestaurantAI Backup"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\backup-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; WorkingDir: "{app}"
Name: "{group}\RestaurantAI Documentation"; Filename: "{app}\docs\WINDOWS_DEPLOYMENT.md"
Name: "{autodesktop}\RestaurantAI"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\start-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"" -OpenBrowser"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{sys}\icacls.exe"; Parameters: """{#StateRoot}\config"" /inheritance:r /grant:r ""*S-1-5-18:(OI)(CI)(F)"" ""*S-1-5-32-544:(OI)(CI)(F)"" ""*S-1-5-32-545:(OI)(CI)(RX)"""; StatusMsg: "Securing RestaurantAI configuration..."; Flags: runhidden waituntilterminated
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\setup-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; StatusMsg: "Configuring RestaurantAI..."; Flags: waituntilterminated skipifsilent; Check: WizardIsTaskSelected('configure')
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\configure-firewall.ps1"" -Action Add -Port 5001"; StatusMsg: "Configuring private-network firewall rule..."; Flags: waituntilterminated skipifsilent; Check: WizardIsTaskSelected('firewall')
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-startup-task.ps1"" -Action Install -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; StatusMsg: "Installing startup task..."; Flags: waituntilterminated skipifsilent; Check: WizardIsTaskSelected('autostart')
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\start-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"" -OpenBrowser"; StatusMsg: "Starting RestaurantAI..."; Flags: nowait skipifsilent; Check: WizardIsTaskSelected('startnow')

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\stop-restaurantai.ps1"" -InstallRoot ""{app}"" -StateRoot ""{#StateRoot}"""; Flags: runhidden waituntilterminated; RunOnceId: "RestaurantAI_Stop_Server"
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

  if (not RunHidden(ExpandConstant('{sys}\cmd.exe'), '/C where node.exe', ResultCode)) or (ResultCode <> 0) then begin
    MsgBox('Node.js 18+ was not detected on PATH. Install Node.js before starting RestaurantAI. The installer will still copy application files.', mbInformation, MB_OK);
  end;

  if (not FileExists('C:\Program Files\PostgreSQL\18\bin\psql.exe')) and
     (not FileExists('C:\Program Files\PostgreSQL\17\bin\psql.exe')) and
     (not FileExists('C:\Program Files\PostgreSQL\16\bin\psql.exe')) and
     (not FileExists('C:\Program Files\PostgreSQL\15\bin\psql.exe')) then begin
    MsgBox('PostgreSQL tools were not detected in the common install folders. Configure PostgreSQL after installation, then run RestaurantAI setup.', mbInformation, MB_OK);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  Parameters: String;
begin
  if CurStep = ssInstall then begin
    if FileExists(ExpandConstant('{app}\scripts\stop-restaurantai.ps1')) then begin
      Parameters := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\stop-restaurantai.ps1') + '" -InstallRoot "' + ExpandConstant('{app}') + '" -StateRoot "' + ExpandConstant('{commonappdata}\RestaurantAI') + '"';
      RunHidden(PowerShellPath(), Parameters, ResultCode);
    end;

    if ExistingInstall() and FileExists(ExpandConstant('{app}\scripts\backup-restaurantai.ps1')) and FileExists(ExpandConstant('{commonappdata}\RestaurantAI\config\.env')) then begin
      Parameters := '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{app}\scripts\backup-restaurantai.ps1') + '" -InstallRoot "' + ExpandConstant('{app}') + '" -StateRoot "' + ExpandConstant('{commonappdata}\RestaurantAI') + '"';
      if (not RunHidden(PowerShellPath(), Parameters, ResultCode)) or (ResultCode <> 0) then begin
        MsgBox('RestaurantAI pre-upgrade backup failed. The upgrade will stop so the database is not put at risk.', mbError, MB_OK);
        Abort();
      end;
    end;
  end;
end;
