type ArgHandler = (value: any) => any;
export interface ArgParserConfig {
  key: string;
  type: 'string' | 'boolean' | 'number' | 'array' | 'object';
  expectedValues?: string[];
  defaultValue?: any;
  matcher?: 'startsWith' | 'equalTo' | 'includes';
  handler?: ArgHandler;
}

const getArgMatcher = (arg_config: ArgParserConfig) => {
  switch (arg_config.matcher) {
    case 'equalTo':
      return (arg: string) =>
        arg === `--${camelToKebab(arg_config.key)}` ||
        arg === `--${arg_config.key}`;
    case 'includes':
      return (arg: string) => arg.includes(camelToKebab(arg_config.key));
    case 'startsWith':
    default:
      return (arg: string) =>
        arg.startsWith(`--${camelToKebab(arg_config.key)}`) ||
        arg.startsWith(`--${arg_config.key}`);
  }
};

const escapeString = (classes: string, escape = true) => {
  const exclude = ['&nbsp;', '\xa0', '\xa0\xa0', '_space_'];
  if (!escape || exclude.some((c) => c === classes)) {
    return classes;
  }
  const specialCharsRegExp = /[!"#$%&'()*+,./:;<=>?@\[\]\\^`{|}~]/g;
  // Replace special characters with their escaped versions
  return classes.replace(specialCharsRegExp, '\\$&');
};

const replaceString = (
  originalString: string,
  valueToReplace: string,
  start = true,
  newValue: string = ''
) => {
  const startValid =
    start &&
    originalString &&
    valueToReplace &&
    originalString.startsWith(valueToReplace);
  const endValid =
    !start &&
    originalString &&
    valueToReplace &&
    originalString.endsWith(valueToReplace);
  if (!startValid && !endValid) {
    return originalString;
  }
  const regex = new RegExp(
    start
      ? '^' + escapeString(valueToReplace)
      : escapeString(valueToReplace) + '$'
  );
  return originalString.replace(regex, newValue);
};

const isInt = (values: any) => {
  if (!Number.isNaN(parseInt(values))) {
    if (parseInt(values.toString()).toString() === values.toString()) {
      return true;
    }
  }
  return false;
};

export const camelToKebab = <T extends string>(_str: T, separator = '-') => {
  let str = _str as string;
  if (isInt(str)) {
    return str;
  }
  const wordPattern =
    /([a-z]+|[A-Z][a-z]*|[A-Z]+(?=[A-Z][a-z])|((\d+|\[(.*)\]|\/)(.*?)(?!(?:[xl\|sm\|md\|lg\|xl\|xxl]|\/|%|[\d\.\d]))))/g;
  let result = '';
  if (str.startsWith('-') && !str.startsWith('--')) {
    result = `-${result}`;
    str = replaceString(str, '-', true, '');
  } else if (str.startsWith('--')) {
    result = `--${result}`;
    str = replaceString(str, '--', true, '');
  }
  const words = str.match(wordPattern) || []; // Extract words using regex
  const kebabCase = words
    .map((word) => word.toLowerCase())
    .join(`${separator}`); // Join words with hyphens
  result += kebabCase.replace(
    new RegExp(`${separator.repeat(2)}`, 'g'),
    `\\${separator}`
  );
  return result;
};

const getDefaultValue = (arg_config: ArgParserConfig) => {
  if (typeof arg_config.defaultValue !== 'undefined') {
    switch (arg_config.type) {
      case 'string':
        return String(arg_config.defaultValue);
      case 'boolean':
        return Boolean(arg_config.defaultValue);
      case 'number':
        return Number(arg_config.defaultValue);
      case 'array':
        return Array.isArray(arg_config.defaultValue)
          ? arg_config.defaultValue
          : [];
      case 'object':
        return typeof arg_config.defaultValue === 'object' &&
          !Array.isArray(arg_config.defaultValue)
          ? arg_config.defaultValue
          : {};
    }
  }
  return undefined;
};
const handleArgValue = (arg: string, arg_config: ArgParserConfig) => {
  const getBool = (value: string, defaultValue?: boolean) => {
    const str = value.trim().toLowerCase();
    if (
      str === 'true' ||
      str === 'yes' ||
      str === 'on' ||
      str === '1' ||
      str === 'y' ||
      str === 'enabled' ||
      str === ''
    )
      return true;
    if (
      str === 'false' ||
      str === 'no' ||
      str === 'off' ||
      str === '0' ||
      str === 'n' ||
      str === 'disabled'
    )
      return false;
    return defaultValue;
  };
  if (getArgMatcher(arg_config)(arg)) {
    const defaultValue = getDefaultValue(arg_config);
    const value = arg.split('=')[1] || '';
    switch (arg_config.type) {
      case 'string':
        if (value.length === 0) return defaultValue;
        if (typeof value === 'undefined') return defaultValue;
        if (arg_config.expectedValues && arg_config.expectedValues.length > 0) {
          if (!arg_config.handler) {
            if (!arg_config.expectedValues.some((v) => v === value))
              return defaultValue;
            return value;
          }
          const handled = arg_config.handler(value);
          if (
            typeof handled === 'undefined' ||
            !arg_config.expectedValues.includes(handled)
          )
            return defaultValue;
          return String(handled);
        }
        if (arg_config.handler) {
          const handled = arg_config.handler(value);
          if (typeof handled === 'undefined') return defaultValue;
          return String(handled);
        }
        return value;
      case 'boolean':
        const bool = getBool(value, arg_config.defaultValue);
        if (typeof bool === 'undefined') return defaultValue;
        if (arg_config.expectedValues && arg_config.expectedValues.length > 0) {
          if (!arg_config.handler) {
            if (
              !arg_config.expectedValues.some(
                (v) => String(v) === String(value)
              )
            )
              return defaultValue;
            return bool;
          }
          const handled = arg_config.handler(bool);
          if (
            typeof handled === 'undefined' ||
            !arg_config.expectedValues.includes(handled)
          )
            return defaultValue;
          return Boolean(handled);
        }
        if (arg_config.handler) {
          const handled = arg_config.handler(bool);
          if (typeof handled === 'undefined') return defaultValue;
          return Boolean(handled);
        }
        // return Boolean(arg_config.defaultValue);
        return Boolean(bool);
      case 'number':
        if (!isNaN(Number(value))) {
          if (
            arg_config.expectedValues &&
            arg_config.expectedValues.length > 0
          ) {
            if (!arg_config.handler) {
              if (
                !arg_config.expectedValues.some(
                  (v) => String(v) === String(value)
                )
              )
                return defaultValue;
              return Number(value);
            }
            const handled = arg_config.handler(value);
            if (
              typeof handled === 'undefined' ||
              !arg_config.expectedValues.includes(handled)
            )
              return defaultValue;
            return Number(handled);
          }
          if (arg_config.handler) {
            const handled = arg_config.handler(value);
            if (typeof handled === 'undefined') return defaultValue;
            return Number(handled);
          }
          return Number(value);
        }
        return Number(arg_config.defaultValue);
      case 'array':
        const data_value = arg.split(',');
        if (arg_config.expectedValues && arg_config.expectedValues.length > 0) {
          if (!arg_config.handler) {
            if (!arg_config.expectedValues.some((v) => data_value.includes(v)))
              return defaultValue;
            return data_value;
          }
          const handled = arg_config.handler(data_value);
          if (
            typeof handled === 'undefined' ||
            !arg_config.expectedValues.includes(handled)
          )
            return defaultValue;
          return Array.isArray(handled) ? handled : [];
        }
        if (arg_config.handler) {
          const handled = arg_config.handler(data_value);
          if (typeof handled === 'undefined') return defaultValue;
          return Array.isArray(handled) ? handled : [];
        }
        return data_value;
      case 'object':
        const data_object_value = JSON.parse(arg);
        if (arg_config.expectedValues && arg_config.expectedValues.length > 0) {
          if (!arg_config.handler) {
            if (
              !arg_config.expectedValues.some(
                (v) => JSON.stringify(v) === JSON.stringify(data_object_value)
              )
            )
              return defaultValue;
            return data_object_value;
          }
          const handled = arg_config.handler(data_object_value);
          if (
            typeof handled === 'undefined' ||
            !arg_config.expectedValues.includes(handled)
          )
            return defaultValue;
          return typeof handled === 'object' ? handled : {};
        }
        if (arg_config.handler) {
          const handled = arg_config.handler(data_object_value);
          if (typeof handled === 'undefined') return defaultValue;
          return typeof handled === 'object' ? handled : {};
        }
        return data_object_value;
    }
  }
  return undefined;
};

export function parseProcessArgs<T extends any = {}>(
  argv: string[],
  arg_configs: ArgParserConfig[],
  options?: Partial<T>
) {
  const opts: any = (
    typeof options === 'object' && options ? { ...options } : {}
  ) as T;
  // console.log('arguments', argv);
  for (const arg of argv.slice(2)) {
    const arg_config = arg_configs.find((arg_config) =>
      getArgMatcher(arg_config)(arg)
    );
    if (!arg_config) continue;
    const value = handleArgValue(arg, arg_config);
    opts[arg_config.key] = value;
  }
  for (const arg_config of arg_configs) {
    if (typeof opts[arg_config.key] === 'undefined') {
      opts[arg_config.key] = getDefaultValue(arg_config);
    }
  }
  return opts as T;
}
