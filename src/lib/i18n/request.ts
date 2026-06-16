import { getRequestConfig } from 'next-intl/server';
import { defaultLocale } from './config';

/**
 * next-intl request configuration.
 * 
 * Loads the messages for the current locale on each request.
 * Currently defaults to English; when multiple locales are supported,
 * this can be extended to detect locale from cookies, headers, or URL.
 */
export default getRequestConfig(async () => {
  const locale = defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
