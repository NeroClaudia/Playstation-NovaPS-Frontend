# NovaPS – PlayStation rental website

```
novaps/
├── index.html              Home (guest + logged-in view)
├── pages/
│   ├── login.html
│   ├── signup.html
│   └── forgot-password.html
├── css/
│   └── style.css           Compiled by Tailwind (used by every page)
├── js/
│   ├── main.js             Login state, navbar, "login required" pop-up
│   └── auth.js             Form validation for the pages/ forms
├── src/
│   └── input.css           Tailwind source (fonts, buttons, custom variant)
└── package.json
```

## Run
Open `index.html` in a browser. `css/style.css` is already built.

## Edit with Tailwind
```
npm install        # once
npm run dev        # rebuilds css/style.css while you edit
npm run build      # minified build for final use
```

Login is a demo (localStorage) until a backend/API is connected.
