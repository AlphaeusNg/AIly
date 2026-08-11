# packages/block

OS block controller (Phase 2). **Not implemented yet.**

## Phase 0 dogfood

In-app simulation lives in:

- `apps/web/js/block.js` — policy, try-open match, break-glass validation  
- `apps/web/js/app.js` — arm/disarm UI, countdown modal  

## Future adapter shape

```js
{
  id, label,
  async arm(appKeys): Promise<void>,
  async disarm(appKeys): Promise<void>,
  async isBlocked(appKey): Promise<boolean>,
}
```

Must respect `canArmBlocks` (usage + admin grants) and always allow break-glass.
