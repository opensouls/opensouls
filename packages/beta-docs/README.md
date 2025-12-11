# Soul Engine Docs

## Marking Internal Pages
If you are adding a new page that should only be accessible to OpenSouls employees, then you need to prefix the page name in whatever `_meta.json` the new page is located in with `[I]`. There is a custom nav component that will remove these pages from display if the username is not matched with a hardcoded list.

### Adding users to access
In order to add new users to internal access, you need to add their username (whatever GitHub / Discord username they use to log in) to the array in the custom-nav component.