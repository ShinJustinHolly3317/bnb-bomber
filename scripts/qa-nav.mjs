/** QA 用：從主選單進入對戰（經大廳） */
export async function enterDuelFromMenu(page, sleep) {
  await page.keyboard.press('Enter')
  await sleep(600)
  let state = await page.evaluate(() => window.bnbState ?? null)
  if (state?.scene !== 'lobby') {
    return { ok: false, state, reason: `expected lobby, got ${state?.scene}` }
  }
  await page.keyboard.press('KeyQ')
  await sleep(400)
  await page.keyboard.press('Enter')
  await sleep(1200)
  state = await page.evaluate(() => window.bnbState ?? null)
  if (state?.scene !== 'duel') {
    return { ok: false, state, reason: `expected duel, got ${state?.scene}` }
  }
  return { ok: true, state }
}
