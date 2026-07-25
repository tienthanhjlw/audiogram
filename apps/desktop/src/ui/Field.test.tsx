import { describe, expect, it } from 'vitest'
import { Field, FieldStack } from './Field'
import { renderIntoDom } from './testUtils'

describe('Field', () => {
  it('renders label and children without throwing', () => {
    const { container, unmount } = renderIntoDom(
      <Field label="Wave color">
        <input />
      </Field>,
    )
    expect(container.textContent).toContain('Wave color')
    expect(container.querySelector('input')).not.toBeNull()
    unmount()
  })

  it('FieldStack renders multiple fields', () => {
    const { container, unmount } = renderIntoDom(
      <FieldStack>
        <Field label="A"><span /></Field>
        <Field label="B"><span /></Field>
      </FieldStack>,
    )
    expect(container.textContent).toContain('A')
    expect(container.textContent).toContain('B')
    unmount()
  })
})
