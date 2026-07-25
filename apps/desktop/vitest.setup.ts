// react's `act()` checks this flag before warning that it's being used
// outside a configured test environment.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
