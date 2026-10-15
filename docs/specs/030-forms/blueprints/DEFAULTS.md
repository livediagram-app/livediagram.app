# Forms blueprint defaults

One row per default applied where a spec is silent or qualitative.

| #   | Blueprint | Spec silence                                  | Default applied                                                                 |
| --- | --------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| D1  | forms     | How long a form code is                       | 22 characters of base 62 (~131 bits), so telemetry's id rule also drops it      |
| D2  | forms     | How a question id is made                     | `q-` and 6 random base-36 characters, unique in the form                         |
| D3  | forms     | How unseen responses are counted per reader   | By response number: the last number the reader has seen, one row per form and reader |
| D4  | forms     | Where the hidden field sits                   | A `website` text input, off screen and `aria-hidden`, `tabindex=-1`, autocomplete off |
| D5  | forms     | Which ids a form's creator person carries     | `form:` and the code's first 8 characters                                         |
| D6  | forms     | When a dropdown replaces radios               | Past 7 options, unless Show as Dropdown is set                                   |
