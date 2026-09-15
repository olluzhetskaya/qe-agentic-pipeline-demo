# Legacy Cucumber SUT

The Cucumber tree is **not** in this folder. It lives outside the git
repo. `data/inventory.json` field `sut_root` is the path, resolved from
the migration project root.

This checkout uses:

```text
../../legacy-ta-framework
```

which is `/Users/oluzhe/Downloads/legacy-ta-framework` when the demo
repo sits next to it.

Do not copy a nested `.git`, `.env`, or `node_modules` into this
folder. The inventory skill skips `node_modules`. The gate skips it too.

If the path in `sut_root` is missing, or it has no `*.feature` files,
phase 0a writes `status: "WAITING"` and stops.
