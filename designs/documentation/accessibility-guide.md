# Accessibility Guide

## WCAG 2.1 Compliance

The Floating Chatbot Launcher Design System follows WCAG 2.1 Level AA guidelines.

## Color Contrast

All text and interactive elements maintain a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text.

## Keyboard Navigation

All interactive elements are keyboard accessible:
- Tab navigation through interactive elements
- Enter/Space to activate buttons
- Escape to close dialogs/modals
- Arrow keys for selection in lists

## Screen Reader Support

- Semantic HTML elements
- ARIA labels and descriptions
- Live regions for dynamic content
- Proper heading hierarchy

## Focus Management

- Visible focus indicators
- Focus trap in modals
- Focus restoration after modal close
- Logical tab order

## Motion and Animation

- Reduced motion support via `prefers-reduced-motion`
- Animations are not essential to the experience
- Clear visual feedback for all interactions

## Text and Readability

- Minimum font size: 14px
- Line height: 1.5 or greater
- Clear, simple language
- Avoid ambiguous terms

## Icons

All icon-only buttons include:
- Text label or ARIA label
- Descriptive title attribute
- Clear visual meaning

## Form Accessibility

- Labels associated with form inputs
- Error messages clearly identified
- Required fields marked
- Input validation feedback
