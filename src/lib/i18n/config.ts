/**
 * Internationalization configuration for the clinic platform.
 * 
 * The platform uses next-intl for locale-based string lookup.
 * English is the default (and currently only) locale.
 * New locales can be added by:
 * 1. Adding the locale code to the `locales` array
 * 2. Creating a corresponding messages file in `src/messages/{locale}.json`
 * 
 * No component logic changes are needed to support new languages.
 */

export const locales = ['en'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';
