import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import InteractiveDataVisualization from './components/InteractiveDataVisualization';
import LanguageSwitcher, { I18nProvider } from './components/I18nSupport';
import AccessibilityCompliance from './components/AccessibilityCompliance';
import OnboardingFlow from './components/OnboardingFlow';

// recharts uses ResizeObserver which is not available in jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// URL.createObjectURL is not available in jsdom
global.URL.createObjectURL = jest.fn(() => 'blob:mock');
global.URL.revokeObjectURL = jest.fn();

// ── InteractiveDataVisualization ──────────────────────────────────────────────

describe('InteractiveDataVisualization', () => {
  it('renders the heading', () => {
    render(<InteractiveDataVisualization />);
    expect(screen.getByText('Data Visualization')).toBeInTheDocument();
  });

  it('renders chart type tabs', () => {
    render(<InteractiveDataVisualization />);
    expect(screen.getByRole('tab', { name: /bar/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /line/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pie/i })).toBeInTheDocument();
  });

  it('switches to line chart tab', () => {
    render(<InteractiveDataVisualization />);
    const lineTab = screen.getByRole('tab', { name: /line/i });
    fireEvent.click(lineTab);
    expect(lineTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders export button', () => {
    render(<InteractiveDataVisualization />);
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
  });

  it('renders summary cards', () => {
    render(<InteractiveDataVisualization />);
    expect(screen.getByText('Total Claims')).toBeInTheDocument();
    expect(screen.getByText('Approval Rate')).toBeInTheDocument();
  });
});

// ── I18nSupport ───────────────────────────────────────────────────────────────

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderWithProvider = () =>
    render(
      <I18nProvider>
        <LanguageSwitcher />
      </I18nProvider>
    );

  it('renders the heading', () => {
    renderWithProvider();
    expect(screen.getByText('Multi-language Support')).toBeInTheDocument();
  });

  it('renders language selector button', () => {
    renderWithProvider();
    // The button contains the flag + label text
    expect(screen.getByRole('button', { name: /select language/i })).toBeInTheDocument();
  });

  it('opens language dropdown on click', () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('switches to Spanish', () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    const esOption = screen.getByRole('option', { name: /español/i });
    fireEvent.click(esOption);
    expect(screen.getByText('Panel de Control')).toBeInTheDocument();
  });

  it('shows RTL badge for Arabic', () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole('button', { name: /select language/i }));
    expect(screen.getByText('RTL')).toBeInTheDocument();
  });

  it('renders date and currency format sections', () => {
    renderWithProvider();
    // The h3 text is "{t.date} Format" — in English: "Date Format"
    expect(screen.getByRole('heading', { name: /date format/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /currency format/i })).toBeInTheDocument();
  });
});

// ── AccessibilityCompliance ───────────────────────────────────────────────────

describe('AccessibilityCompliance', () => {
  it('renders the heading', () => {
    render(<AccessibilityCompliance />);
    expect(screen.getByText(/Accessibility Compliance/i)).toBeInTheDocument();
  });

  it('renders skip link', () => {
    render(<AccessibilityCompliance />);
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  it('renders WCAG compliance score', () => {
    render(<AccessibilityCompliance />);
    expect(screen.getByText('WCAG 2.1 AA Compliant')).toBeInTheDocument();
  });

  it('renders tab list', () => {
    render(<AccessibilityCompliance />);
    expect(screen.getByRole('tablist', { name: /accessibility sections/i })).toBeInTheDocument();
  });

  it('switches to contrast tab', () => {
    render(<AccessibilityCompliance />);
    fireEvent.click(screen.getByRole('tab', { name: /contrast/i }));
    expect(screen.getByText('Color Contrast Analysis')).toBeInTheDocument();
  });

  it('switches to keyboard tab', () => {
    render(<AccessibilityCompliance />);
    fireEvent.click(screen.getByRole('tab', { name: /keyboard/i }));
    expect(screen.getByText('Keyboard Navigation')).toBeInTheDocument();
  });

  it('opens accessible modal from demo tab', () => {
    render(<AccessibilityCompliance />);
    fireEvent.click(screen.getByRole('tab', { name: /demo/i }));
    fireEvent.click(screen.getByRole('button', { name: /open accessible modal/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes modal with close button', () => {
    render(<AccessibilityCompliance />);
    fireEvent.click(screen.getByRole('tab', { name: /demo/i }));
    fireEvent.click(screen.getByRole('button', { name: /open accessible modal/i }));
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ── OnboardingFlow ────────────────────────────────────────────────────────────

describe('OnboardingFlow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the onboarding heading', () => {
    render(<OnboardingFlow />);
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
  });

  it('renders the first step welcome title', () => {
    render(<OnboardingFlow />);
    expect(screen.getByText('Welcome to AEGIS')).toBeInTheDocument();
  });

  it('renders progress bar', () => {
    render(<OnboardingFlow />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('advances to next step', () => {
    render(<OnboardingFlow />);
    // The button text is "Get Started →" — use a partial text match
    fireEvent.click(screen.getByRole('button', { name: /continue to set up your profile/i }));
    expect(screen.getByText('Set Up Your Profile')).toBeInTheDocument();
  });

  it('shows validation error when required field is empty', () => {
    render(<OnboardingFlow />);
    // Go to step 1 (profile)
    fireEvent.click(screen.getByRole('button', { name: /continue to set up your profile/i }));
    // Try to continue without filling required fields
    fireEvent.click(screen.getByRole('button', { name: /continue to explore key features/i }));
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  it('goes back to previous step', () => {
    render(<OnboardingFlow />);
    fireEvent.click(screen.getByRole('button', { name: /continue to set up your profile/i }));
    fireEvent.click(screen.getByRole('button', { name: /go to previous step/i }));
    expect(screen.getByText('Welcome to AEGIS')).toBeInTheDocument();
  });

  it('back button is disabled on first step', () => {
    render(<OnboardingFlow />);
    expect(screen.getByRole('button', { name: /go to previous step/i })).toBeDisabled();
  });

  it('saves progress to localStorage on step advance', () => {
    render(<OnboardingFlow />);
    fireEvent.click(screen.getByRole('button', { name: /continue to set up your profile/i }));
    const saved = JSON.parse(localStorage.getItem('aegis-onboarding'));
    expect(saved.step).toBe(1);
  });
});
