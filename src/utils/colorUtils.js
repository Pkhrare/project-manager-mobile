import { colors } from '../styles/colors';

export const getColorClass = (colorName, variant = 'default') => {
  if (!colors[colorName]) return {};
  
  const colorVariant = colors[colorName][variant] || colors[colorName].default;
  
  return {
    backgroundColor: colorVariant,
    borderColor: colorVariant,
  };
};

export const getTextColorClass = (colorName, variant = 'default') => {
  if (!colors[colorName]) return {};
  
  const colorVariant = colors[colorName][variant] || colors[colorName].default;
  
  return {
    color: colorVariant,
  };
};

export const getBorderColorClass = (colorName, variant = 'default') => {
  if (!colors[colorName]) return {};
  
  const colorVariant = colors[colorName][variant] || colors[colorName].default;
  
  return {
    borderColor: colorVariant,
  };
};
