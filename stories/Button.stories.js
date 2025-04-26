import { fn } from '@storybook/test';

import { Button } from './Button';

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
export default {
  title: 'Example/Button',
  tags: ['autodocs'],
  render: ({ label, ...args }) => {
    return Button({ label, ...args });
  },
};

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const LightMode = {
  args: {
    label: 'Light Mode',
  },
};

export const DarkMode = {
  args: {
    label: 'Dark Mode',
  },
};
