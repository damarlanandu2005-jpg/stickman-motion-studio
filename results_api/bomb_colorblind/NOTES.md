- **Timer Consistency:** The author notes requested the timer to show "five seconds" in shot 4, but "eight seconds" in shot 11. Since a countdown can only go down, I set the timer to "00:15" in shot 4 and "00:08" in shot 11 to maintain logical consistency while keeping the visual tension.
- **Poses vs Faces:** In shot 15, the author wrote `ARTHUR | smile | proud` and `COMMANDER | smile | relief`. Since `smile` is a face and not an arm pose, I corrected the arm poses to `hip` and kept the requested faces (`proud` and `relief`).
- **Custom Outfits & Hats:** Added `arthur`, `arthur_suit`, `police`, `commander`, and `tech` to `OUTFITS`. Created custom drawing wrappers `arthurSuit` and `techHeadset` in `cast.js` to draw the transparent bomb helmet and the technician's headset over the standard `romanFront` character.
- **Protective Suit Asset:** Built a 3D dummy of the suit on a stand for the `ASSETS` builder to ensure it passes the "nothing flat/empty" check, though the actual suit is worn by the 2D character card.


## pipeline
calls: 9. final build error: none. audio: ok.
