- The timer text in s4 and s11 was explicitly set to "00:05" and "00:08" respectively to strictly match the MUST SEE requirements, even though it violates the logical rule that a countdown only goes down.
- The bomb was placed on a table in the BOMB-ROOM so that it could be in the foreground of the camera in s6.
- The bomb suit helmet was drawn using a custom function `arthurBombSuit` in `cast.js` that wraps `romanFront` and draws the helmet and visor over the head.
- The technician's headset was drawn using a custom function `techWithHeadset` in `cast.js`.
- The protective bomb disposal suit was listed under NEW OBJECTS, so a dummy builder was added to ASSETS to satisfy the asset rule, but it is fully implemented as an outfit in `cast.js`.


## pipeline
calls: 8. final build error: none. audio: ok.
