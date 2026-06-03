!include "MUI2.nsh"

!ifndef APP_SOURCE_DIR
  !error "APP_SOURCE_DIR must point to the packaged SWARMSY Desktop artifact directory."
!endif

!ifndef INSTALLER_OUTPUT
  !define INSTALLER_OUTPUT "SWARMSY-Desktop-Setup.exe"
!endif

Name "SWARMSY Desktop"
OutFile "${INSTALLER_OUTPUT}"
InstallDir "$LOCALAPPDATA\Programs\SWARMSY Desktop"
RequestExecutionLevel user
Unicode true
SetCompressor /SOLID lzma

!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_FINISHPAGE_RUN "$INSTDIR\SWARMSY Desktop.exe"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "SWARMSY Desktop" SEC_INSTALL
  SetOutPath "$INSTDIR"
  File /r "${APP_SOURCE_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall SWARMSY Desktop.exe"

  CreateDirectory "$SMPROGRAMS\SWARMSY Desktop"
  CreateShortcut "$SMPROGRAMS\SWARMSY Desktop\SWARMSY Desktop.lnk" "$INSTDIR\SWARMSY Desktop.exe"
  CreateShortcut "$SMPROGRAMS\SWARMSY Desktop\Uninstall SWARMSY Desktop.lnk" "$INSTDIR\Uninstall SWARMSY Desktop.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\SWARMSY Desktop\SWARMSY Desktop.lnk"
  Delete "$SMPROGRAMS\SWARMSY Desktop\Uninstall SWARMSY Desktop.lnk"
  RMDir "$SMPROGRAMS\SWARMSY Desktop"

  Delete "$INSTDIR\Uninstall SWARMSY Desktop.exe"
  Delete "$INSTDIR\SWARMSY Desktop.exe"
  RMDir /r "$INSTDIR\resources"
  RMDir "$INSTDIR"
SectionEnd
