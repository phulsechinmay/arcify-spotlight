describe('Test Setup', () => {
  it('vitest runs', () => {
    expect(true).toBe(true);
  });

  it('chrome mock is available', () => {
    expect(globalThis.chrome).toBeDefined();
    expect(globalThis.chrome.tabs).toBeDefined();
    expect(globalThis.chrome.storage).toBeDefined();
  });
});
