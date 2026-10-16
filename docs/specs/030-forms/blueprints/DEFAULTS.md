# Forms blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                                   | Default applied                                                                       |
| --- | --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| D1  | forms     | How long a form code is                        | 22 characters of base 62 (~131 bits), so telemetry's id rule also drops it            |
| D2  | forms     | How a question id is made                      | `q-` and 6 random base-36 characters, unique in the form                              |
| D3  | forms     | How unseen responses are counted per reader    | By response number: the last number the reader has seen, one row per form and reader  |
| D4  | forms     | Where the hidden field sits                    | A `website` text input, off screen and `aria-hidden`, `tabindex=-1`, autocomplete off |
| D5  | forms     | Which ids a form's creator person carries      | `form:` and the code's first 8 characters                                             |
| D6  | forms     | When a dropdown replaces radios                | Past 7 options, unless Show as Dropdown is set                                        |
| D7  | forms     | How often an open Form tab rereads its count   | Every 30 seconds while the page is visible                                            |
| D8  | forms     | When text typed in the builder is saved        | Half a second after typing pauses, and when the field is left                         |
| D9  | forms     | How many opened response cards a browser keeps | The newest 500 ids                                                                    |
| D10 | forms     | Where the Form Panel docks                     | Beside the form from 1,100 px wide; a sheet over it below                             |
| D11 | forms     | How Sketch draws a form's boxes                | Uneven elliptical corners (255/14 px), 2 px slate ink, a 2×3 px pencil shadow         |
| D12 | forms     | Which theme colour is a form's                 | The shared theme accent; the brand blue of each half on Default                       |
| D13 | forms     | Where add_form puts a new Form tab             | After the document's last tab; its responses tab right after it                       |
| D14 | forms     | Where questions given alone send responses     | A new board, so the form can be published at once                                     |
| D15 | forms     | How an agent's question names its type         | By the model's id (`short`, `single`...), each described with the builder's name      |
