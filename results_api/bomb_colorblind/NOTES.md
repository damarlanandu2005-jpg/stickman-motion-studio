# Notes

- **Poses**: Used `reach`, `temple`, `point`, `hang`, `hip` as requested.
- **Faces**: Used `determined` (alias for stubborn/stern), `nervous` (alias for worried/neutral), `shock+sparkle`, `proud`, `nervous+sweat`.
- **Assets**: Created `STREET`, `BOMB-TENT`, `COMMAND-POST` environments. Created `bomb`, `circuit board`, `wire bundle`, `wire snips`, `digital timer` as 3D objects.
- **Characters**: Handled `bomb suit` and `police uniform` via custom wrapper functions in `cast.js` to draw the helmet visor and police cap brim over the standard `romanFront` output.
- **Camera/Staging**: Since the kit does not support a true "back view" for characters, shots where Arthur faces away from the camera (e.g., s3, s11) were staged with Arthur positioned behind the bomb, facing the camera, reaching forward. This preserves the "MUST NOT: face hidden" rule while keeping the spatial relationship correct.
- **Timer**: Implemented the digital timer as a custom `fxTimerText` card that counts down based on the frame number.


## pipeline
calls: 9. final build error: none. audio: ok.
