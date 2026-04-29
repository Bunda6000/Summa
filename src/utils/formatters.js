export const fmt = (n) => new Intl.NumberFormat("en-US",{minimumFractionDigits:0,maximumFractionDigits:2}).format(n||0);
