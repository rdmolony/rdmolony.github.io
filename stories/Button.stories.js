import { fn } from '@storybook/test';

export const Button = ({
  className,
  label,
}) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.innerText = label;
  btn.className = className;
  return btn;
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
export default {
  title: 'Example/Button',
  tags: ['autodocs'],
  render: ({ label, ...args }) => {
    return Button({ label, ...args });
  },
  args: {
    label: 'Button',
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
