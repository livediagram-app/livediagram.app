# Interface design blueprint completeness

## undo-not-confirm

- [x] Domain and naming
- [x] Behaviour and state
- [x] Interfaces and contracts
- [ ] Data and persistence (nothing new is stored; Undo is an ordinary edit)
- [x] Errors and edge cases
- [ ] Security and trust (no new input or boundary; the actions keep their gates)
- [x] Performance and limits
- [x] Presentation and UX
- [x] Accessibility
- [x] Testing

## action-parity

- [x] Domain and naming
- [x] Behaviour and state
- [x] Interfaces and contracts
- [ ] Data and persistence (nothing is stored; the menu and the shared sections are presentation)
- [x] Errors and edge cases
- [ ] Security and trust (no new input or boundary; the tab bar keeps who may open the menu)
- [x] Performance and limits
- [x] Presentation and UX
- [x] Accessibility
- [x] Testing

## close-button

- [x] Domain and naming
- [x] Behaviour and state
- [x] Interfaces and contracts
- [ ] Data and persistence (nothing is stored; the close is presentation)
- [x] Errors and edge cases
- [ ] Security and trust (no new input or boundary)
- [x] Performance and limits
- [x] Presentation and UX
- [x] Accessibility
- [x] Testing

## voice-input

- [x] Domain and naming
- [x] Behaviour and state
- [x] Interfaces and contracts
- [ ] Data and persistence (nothing is stored; the words go into the host field)
- [x] Errors and edge cases
- [x] Security and trust (no new boundary; the browser asks for the microphone, and the help says its speech service may hear the sound)
- [x] Performance and limits
- [x] Presentation and UX
- [x] Accessibility
- [x] Testing
