// Its own module so the layout, which every marketing page shares, pulls in this one line and not the
// template catalogue behind the fan.

// Before first paint (inline in the landing page's <head>): marks <html data-hero-deal> once script
// runs, so the fan's static opening hand stays hidden until the shuffled one deals in (css/hero-fan.css,
// which also shows it after a moment should the page's script never arrive).
export const HERO_FAN_BOOT_SCRIPT = "document.documentElement.setAttribute('data-hero-deal','')";
