import { render, screen } from '@testing-library/react';
import Button from '../lib/Button';

test('renders button with children', () => {
  render(<Button>Click Me</Button>);
  const buttonElement = screen.getByText(/Click Me/i);
  expect(buttonElement).toBeInTheDocument();
});

test('applies variant class', () => {
  const { container } = render(<Button variant="secondary">Secondary</Button>);
  expect(container.firstChild).toHaveClass('btn-secondary');
});

test('is disabled when isLoading is true', () => {
  render(<Button isLoading={true}>Loading</Button>);
  const buttonElement = screen.getByRole('button');
  expect(buttonElement).toBeDisabled();
});
