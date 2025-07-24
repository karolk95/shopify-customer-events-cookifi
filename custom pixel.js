/*
 * Project: Shopify Customer Events Tracking with GTM & Cookifi
 * Author: Karol Krajcir (https://www.karolkrajcir.com)
 * Version: 2.0 (cookifi consent cookie instead of Shopify's cookie, discount calculations fix, smaller improvements - pixelLog function added, var replaced with let)
 * License: GNU General Public License (GPL) (with restrictions) - more here: https://github.com/karolk95/shopify-customer-events-cookifi/blob/main/LICENSE
 *
 * Restriction: This code may not be incorporated into commercial software products
 * or applications that are sold or generate revenue without express permission from the author.
 *
 * Disclaimer: THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
 * OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 * 
 *
 * Important Notice:
 * This script integrates with Cookifi to help manage consent signals via Shopify's Customer Events and Google Tag Manager.
 * However, ensuring legal compliance with data privacy regulations (such as GDPR, CCPA, etc.) is the sole responsibility 
 * of the store owner. Use of this code does not guarantee legal compliance.
 */

/* *********************************************************************************
****************************** GLOBAL SETTINGS *************************************
make sure to go through the settings below and change the values where applicable
********************************************************************************** */
const config = {
    /* *************** CONVERSION TRACKING SETTINGS *************** */
    conversionTracking: {
        gtmContainerId: 'GTM-XXXXXX', // replace with your Google Tag Manager container ID
        googleProductIdType: 'productVariant', // product ID type for Google Analytics and Google Ads. Keep 'shopify' if you are using any product feed management tool like GMC. Alternatively, change to 'productVariant', 'productVariantProductId', or 'sku'.
        // change to false for events that you don't want to be pushed to the data layer:
        trackPageViews: true,
        trackClicks: true,
        trackSearch: true,
        trackFormSubmit: true,
        trackViewItemList: true,
        trackViewItem: true,
        trackAddToCart: true,
        trackViewCart: true,
        trackRemoveFromCart: true,
        trackBeginCheckout: true,
        trackAddShippingInfo: true,
        trackAddPaymentInfo: true,
        trackPurchase: true,
    },

    /* *************** STORE SETTINGS *************** */
    store: {
        affiliationName: init.data.shop.name, // or you can replace it with some other value
    },

    /* *************** CONSENT SETTINGS *************** */
    consent: {
        // keep the defaults if you don't know what you're doing
        waitForUpdate: 500, // specify how long to wait (in ms) for the GTAG update command before tags fire
        adsDataRedaction: true, // redact further ad data when ad_storage is denied
        urlPassthrough: true, // pass ad click information through URL parameters across pages if ad_storage is denied
    },

    /* *************** GOOGLE ADS REMARKETING SETTINGS *************** */
    remarketingGoogleAds: {
        enabled: false,
        googleBusinessVertical: 'retail', // 'retail' is for ecommerce, other examples include 'flights', 'education', 'jobs', ...
        // if you're using 'shopify' for googleProductIdType, make sure to adjust the below two constants:
        productIdPrefix: 'shopify', // don't change this if you don't know what you're doing
        remarketingCountryCode: 'XX', // 2-letter country code in uppercase (Alpha-2 code), e.g. 'US' for United States
    },    

    /* *************** META ADS REMARKETING SETTINGS *************** */
    remarketingMetaAds: {
        enabled: false,
    }, 

    /* *************** PINTEREST ADS REMARKETING SETTINGS *************** */
    remarketingPinterestAds: {
        enabled: false,
    },

    /* *************** DEVELOPER SETTINGS *************** */
    developer: {
        consoleLogging: false, // set to true if you want to see the console logs
    },

}
/* *********************************************************************************
****************************** END OF GLOBAL SETTINGS ******************************
********************************************************************************** */

// retrieve initial information about the page and user
const initContextData = init.context?.document;
const initCustomerData = init.data?.customer;

let initInfo = {
    page_location: initContextData?.location?.href,
    page_referrer: initContextData?.referrer,
    page_title: initContextData?.title,
};

// retrieve user data, but only include it if it's defined
let userData = {};
if (initCustomerData?.email) userData.email = initCustomerData.email;
if (initCustomerData?.firstName) userData.firstName = initCustomerData.firstName;
if (initCustomerData?.lastName) userData.lastName = initCustomerData.lastName;
if (initCustomerData?.id) userData.id = initCustomerData.id;
if (initCustomerData?.phone) userData.phone = initCustomerData.phone;
if (initCustomerData?.ordersCount) userData.ordersCount = initCustomerData.ordersCount;

// add user data to the initInfo object if at least one value exists
if (Object.keys(userData).length > 0) {
    initInfo.user_data = userData;
}

// initiate dataLayer & gtag
window.dataLayer = window.dataLayer || [];
window.dataLayerTemp = [];
function gtag() {
    dataLayer.push(arguments);
}

// function to log messages to the console (if enabled in the config)
function pixelLog(message, ...data) {
    if (!config.developer.consoleLogging) return;
    console.log(`>>> PIXEL: ${message}`, ...data);
}

// push events to the correct dataLayer, based on whether consent has been established (i.e., loaded from the API)
function safePush(eventData) {
    if (isConsentLoaded) {
        window.dataLayer.push(eventData);
    } else {
        window.dataLayerTemp.push(eventData);
    }
}

let isConsentLoaded = false;

// Google Consent Mode - Default command
gtag("consent", "default", {
    ad_personalization: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    analytics_storage: "denied",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "granted",
    wait_for_update: config.consent.waitForUpdate,
});
gtag("set", "ads_data_redaction", config.consent.adsDataRedaction);
gtag("set", "url_passthrough", config.consent.urlPassthrough);

// load GTM container
(function (w, d, s, l, i) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var f = d.getElementsByTagName(s)[0],
        j = d.createElement(s), dl = l != 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
})(window, document, 'script', 'dataLayer', config.conversionTracking.gtmContainerId);
pixelLog('>>> PIXEL: GTM loaded with container ID: ', config.conversionTracking.gtmContainerId);

// function to check if the current page is checkout
function isCheckoutPage() {
    return initContextData?.location?.href.includes('/checkouts/');
}

// function to get the cookifi-consent cookie value
function getTrackingConsentCookie() {
    const cookie = document.cookie.split('; ').find(row => row.startsWith('cookifi-consent='));
    if (!cookie) return null; // no consent cookie exists

    try {
        const cookieValue = decodeURIComponent(cookie.split('=')[1]);
        const consentPairs = cookieValue.split(',');
        const consent = {};

        consentPairs.forEach(pair => {
            const [key, value] = pair.split(':');
            consent[key.trim()] = value.trim();
        });

        return consent;
    } catch (error) {
        console.error('>>> PIXEL: Failed to parse cookifi-consent cookie: ', error);
        return null;
    }
}

// handle consent on checkout pages (using the cookifi-consent cookie)
if (isCheckoutPage()) {
    let consentCookie = getTrackingConsentCookie();
    let customerPrivacyStatus = {
        analyticsProcessingAllowed: false,
        marketingAllowed: false,
        preferencesProcessingAllowed: false,
        saleOfDataAllowed: false
    };

    if (consentCookie) {
        customerPrivacyStatus = {
            analyticsProcessingAllowed: consentCookie.analytics === "true",
            marketingAllowed: consentCookie.marketing === "true",
            preferencesProcessingAllowed: consentCookie.preferences === "true",
            saleOfDataAllowed: consentCookie.marketing === "true"
        };
    }

    pixelLog('>>> PIXEL: Checkout detected - Using cookifi-consent cookie: ', consentCookie, 'Parsed as: ', customerPrivacyStatus);

    // Google Consent Mode - Update command
    gtag('consent', 'update', {
        analytics_storage: customerPrivacyStatus.analyticsProcessingAllowed ? 'granted' : 'denied',
        ad_storage: customerPrivacyStatus.marketingAllowed ? 'granted' : 'denied',
        ad_user_data: customerPrivacyStatus.marketingAllowed ? 'granted' : 'denied',
        ad_personalization: customerPrivacyStatus.marketingAllowed ? 'granted' : 'denied',
        personalization_storage: customerPrivacyStatus.preferencesProcessingAllowed ? 'granted' : 'denied',
        functionality_storage: customerPrivacyStatus.preferencesProcessingAllowed ? 'granted' : 'denied',
        security_storage: 'granted'
    });

    window.dataLayer.push({
        event: 'cookifi-consent-update',
        cookie_consent_marketing: customerPrivacyStatus.marketingAllowed ? 'granted' : 'denied',
        cookie_consent_statistics: customerPrivacyStatus.analyticsProcessingAllowed ? 'granted' : 'denied',
        cookie_consent_preferences: customerPrivacyStatus.preferencesProcessingAllowed ? 'granted' : 'denied'
    });

    // Push queued events
    window.dataLayerTemp.forEach(item => window.dataLayer.push(item));
    window.dataLayerTemp = [];

    isConsentLoaded = true;
}

// handle consent on storefront (using visitorConsentCollected event)
if (!isCheckoutPage()) {
  api.customerPrivacy.subscribe('visitorConsentCollected', (event) => {
      let customerPrivacyStatus = event.customerPrivacy;
  
      pixelLog('>>> PIXEL: Visitor consent collected: ', customerPrivacyStatus, ' ... going to update consent and push the queued events.');
  
      // Google Consent Mode - Update command
      gtag('consent', 'update', {
          analytics_storage: customerPrivacyStatus.analyticsProcessingAllowed ? 'granted' : 'denied',
          ad_storage: customerPrivacyStatus.marketingAllowed ? 'granted' : 'denied',
          ad_user_data: customerPrivacyStatus.marketingAllowed ? 'granted' : 'denied',
          ad_personalization: customerPrivacyStatus.marketingAllowed ? 'granted' : 'denied',
          personalization_storage: customerPrivacyStatus.preferencesProcessingAllowed ? 'granted' : 'denied',
          functionality_storage: customerPrivacyStatus.preferencesProcessingAllowed ? 'granted' : 'denied',
          security_storage: 'granted'
      });
  
      window.dataLayer.push({
          event: 'cookifi-consent-update',
          cookie_consent_marketing: customerPrivacyStatus.marketingAllowed ? 'granted' : 'denied',
          cookie_consent_statistics: customerPrivacyStatus.analyticsProcessingAllowed ? 'granted' : 'denied',
          cookie_consent_preferences: customerPrivacyStatus.preferencesProcessingAllowed ? 'granted' : 'denied'
      });
  
      // push the queued events from the temporary dataLayer to the main dataLayer
      window.dataLayerTemp.forEach(item => window.dataLayer.push(item));
      isConsentLoaded = true;

      pixelLog('>>> PIXEL: Consent has been updated & queued events pushed');
      pixelLog('>>> PIXEL: dataLayerTemp: ', window.dataLayerTemp);
      pixelLog('>>> PIXEL: dataLayer: ', window.dataLayer);

      window.dataLayerTemp = [];
  });
}

// push initInfo object (page & user data) to dataLayer
dataLayer.push(initInfo);
pixelLog('>>> PIXEL: Initial info DL object: ', initInfo);

/* *******************************************************************************
****************************** NON-ECOMMERCE EVENTS ******************************
********************************************************************************** */


/* *************** PAGE VIEW TRACKING *************** */
if (config.conversionTracking.trackPageViews) {
    analytics.subscribe('page_viewed', (event) => {

        const eventContextData = event.context?.document;
        const eventPayload = {
            event: 'page_view',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
        };

        safePush(eventPayload);
        pixelLog('>>> PIXEL: safePush function called with: ', eventPayload);
    });
}
/* *************** END OF PAGE VIEW TRACKING *************** */

if (config.conversionTracking.trackClicks) {
    /* *************** CLICK TRACKING - storefront *************** */
    analytics.subscribe('custom_click', (event) => {

        const eventContextData = event.context?.document;
        const eventPayload = {
            event: 'custom_click_storefront',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            data: event.customData,
        };

        safePush(eventPayload);
        pixelLog('>>> PIXEL: safePush function called with: ', eventPayload);
    });

    analytics.subscribe('custom_link_click', (event) => {

        const eventContextData = event.context?.document;
        const eventPayload = {
            event: 'custom_click_link_storefront',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            data: event.customData,
        };

        safePush(eventPayload);
        pixelLog('>>> PIXEL: safePush function called with: ', eventPayload);
    });
    /* *************** END OF CLICK TRACKING - storefront *************** */

    /* *************** CLICK TRACKING - checkout *************** */
    if (initContextData?.location?.href.includes('/checkouts/')) {
        analytics.subscribe('clicked', (event) => {

            const element = event.data?.element;
            const eventContextData = event.context?.document;
            const eventPayload = {
                event: 'custom_click_checkout',
                page_location: eventContextData?.location?.href,
                page_referrer: eventContextData?.referrer,
                page_title: eventContextData?.title,
                data: {
                    click_element: element?.type || '',
                    click_id: element?.id || '',
                    click_classes: '',
                    click_text: element?.value || '',
                    click_target: '',
                    click_url: element?.href || '',
                }
            };

            safePush(eventPayload);
            pixelLog('>>> PIXEL: safePush function called with: ', eventPayload);
        });
    }
    /* *************** END OF CLICK TRACKING - checkout *************** */
}

/* *************** SEARCH *************** */
if (config.conversionTracking.trackSearch) {
    analytics.subscribe('search_submitted', (event) => {

        const eventContextData = event.context?.document;
        const eventPayload = {
            event: 'view_search_results',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            search_term: event.data?.searchResult?.query,
        };

        safePush(eventPayload);
        pixelLog('>>> PIXEL: safePush function called with: ', eventPayload);

        // Meta Ads - 5 first search results - product IDs
        if (config.remarketingMetaAds.enabled) {
            const topProductIDs = event.data?.searchResult?.productVariants?.slice(0, 5).map(productVariant => {
                return getProductId(
                    productVariant,
                    config.conversionTracking.googleProductIdType,
                    config.remarketingGoogleAds.productIdPrefix,
                    config.remarketingGoogleAds.remarketingCountryCode
                    );
            }) || [];

            // Push to the data layer
            const eventPayloadMetaAds = {
                event: 'meta_ads_search_results',
                content_ids: topProductIDs,
                search_string: event.data?.searchResult?.query
            };

            safePush(eventPayloadMetaAds);
            pixelLog('>>> PIXEL: safePush function called with: ', eventPayloadMetaAds);
        }

    });
}
/* *************** END OF SEARCH *************** */

/* *************** FORM SUBMIT *************** */
if (config.conversionTracking.trackFormSubmit) {
    analytics.subscribe('form_submitted', (event) => {

        const eventContextData = event.context?.document;
        const eventPayload = {
            event: 'form_submit',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            form_action: event.data?.element?.action,
            form_id: event.data?.element?.id,
        };

        // decode the form action URL before checking for '/cart/add'
        const decodedAction = decodeURIComponent(event.data?.element?.action || '');

        // only fire form_submit if the form_action does NOT contain '/cart/add'
        if (!decodedAction.includes('/cart/add')) {
            safePush(eventPayload);
            pixelLog('>>> PIXEL: safePush function called with: ', eventPayload);
        }
    });
}
/* *************** END OF FORM SUBMIT *************** */


/* *******************************************************************************
****************************** ECOMMERCE EVENTS **********************************
********************************************************************************** */


// Function to get product ID based on the user's choice between 'shopify', 'productVariant', or 'sku'
function getProductId(item, type, productIdPrefix, countryCode) {
    if (type === 'shopify') {
        return productIdPrefix + '_' + countryCode + '_' + item.product?.id + '_' + item.id;
    } else if (type === 'productVariant') {
        return item.product?.id;
    } else if (type === 'productVariantProductId') {
        return item.product?.id + '_' + item.id;
    } else if (type === 'sku') {
        return item.sku;
    }
}

/* *************** VIEW ITEM LIST *************** */
if (config.conversionTracking.trackViewItemList) {
    analytics.subscribe('collection_viewed', (event) => {

        const eventContextData = event.context?.document;
        const collection = event.data?.collection;
        let googleAnalyticsProducts = [];
        let googleAdsProducts = [];

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', collection);

        // loop through the products:
        collection?.productVariants?.forEach(function (item, index) {

            // Get the unified Product ID based on config.googleProductIdType
            const googleProductId = getProductId(
                item,
                config.conversionTracking.googleProductIdType,
                config.remarketingGoogleAds.productIdPrefix,
                config.remarketingGoogleAds.remarketingCountryCode
            );

            pixelLog('>>> PIXEL: Generated Google Product ID: ', googleProductId);

            // GA4 - get the product info
            let productVariant = {
                item_id: googleProductId,
                item_name: item.product?.title,
                affiliation: config.store.affiliationName,
                index: index,
                item_brand: item.product?.vendor,
                item_category: item.product?.type,
                item_list_id: collection?.id,
                item_list_name: collection?.title,
                price: item.price?.amount,
                quantity: 1
            };
            googleAnalyticsProducts.push(productVariant);

            // GAds (dynamic remarketing) - get the product info
            let remarketingItem = {
                id: googleProductId,
                google_business_vertical: config.remarketingGoogleAds.googleBusinessVertical
            };
            googleAdsProducts.push(remarketingItem);
    
        });

        // construct the data layer object:
        let dataLayerObj = {
            event: 'view_item_list',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                item_list_id: collection?.id,
                item_list_name: collection?.title,
                items: googleAnalyticsProducts
            }
        }

        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            dataLayerObj.googleAdsDynamicRemarketing = {
                value: collection?.productVariants?.reduce((total, item) => total + parseFloat(item.price?.amount), 0),
                items: googleAdsProducts
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF VIEW ITEM LIST *************** */

/* *************** VIEW ITEM *************** */
if (config.conversionTracking.trackViewItem) {
    analytics.subscribe('product_viewed', (event) => {

        const eventContextData = event.context?.document;
        const productVariant = event.data?.productVariant;
        let googleAnalyticsProducts = [];
        let googleAdsProducts = [];

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', productVariant);

        // Get the unified Product ID based on config.googleProductIdType
        const googleProductId = getProductId(
            productVariant,
            config.conversionTracking.googleProductIdType,
            config.remarketingGoogleAds.productIdPrefix,
            config.remarketingGoogleAds.remarketingCountryCode
        );

        pixelLog('>>> PIXEL: Generated Google Product ID: ', googleProductId);

        // GA4 - get the product info
        let productInfo = {
            item_id: googleProductId,
            item_name: productVariant?.product?.title,
            affiliation: config.store.affiliationName,
            item_brand: productVariant?.product?.vendor,
            item_category: productVariant?.product?.type,
            item_variant: productVariant?.title,
            price: productVariant?.price?.amount,
            quantity: 1
        };
        googleAnalyticsProducts.push(productInfo);

        // construct the data layer object:
        const dataLayerObj = {
            event: 'view_item',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                currency: productVariant?.price?.currencyCode,
                value: productVariant?.price?.amount,
                items: googleAnalyticsProducts
            }
        }

        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            let remarketingItem = {
                id: googleProductId,
                google_business_vertical: config.remarketingGoogleAds.googleBusinessVertical
            };
            googleAdsProducts.push(remarketingItem);

            dataLayerObj.googleAdsDynamicRemarketing = {
                value: productVariant?.price?.amount,
                items: googleAdsProducts
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // Meta Ads (dynamic remarketing)
        if (config.remarketingMetaAds.enabled) {
            dataLayerObj.metaAdsDynamicRemarketing = {
                content_category: productVariant?.product?.type,
                content_name: productVariant?.product?.title, 
                content_ids: [googleProductId],
                value: productVariant?.price?.amount,
                currency: productVariant?.price?.currencyCode,
            }
            safePush({ 'metaAdsDynamicRemarketing': null });
        }

        // Pinterest Ads (dynamic remarketing)
        if (config.remarketingPinterestAds.enabled) {
            dataLayerObj.pinterestAdsDynamicRemarketing = {
                product_id: googleProductId,
                product_category: productVariant?.product?.type
            }
            safePush({ 'pinterestAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF VIEW ITEM *************** */

/* *************** ADD TO CART *************** */
if (config.conversionTracking.trackAddToCart) {
    analytics.subscribe('product_added_to_cart', (event) => {

        const eventContextData = event.context?.document;
        const cartLine = event.data?.cartLine;
        let googleAnalyticsProducts = [];
        let googleAdsProducts = [];

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', cartLine);

        // Get the unified Product ID based on config.googleProductIdType
        const googleProductId = getProductId(
            cartLine?.merchandise,
            config.conversionTracking.googleProductIdType,
            config.remarketingGoogleAds.productIdPrefix,
            config.remarketingGoogleAds.remarketingCountryCode
        );

        pixelLog('>>> PIXEL: Generated Google Product ID: ', googleProductId);

        // GA4 - get the product info
        let productInfo = {
            item_id: googleProductId,
            item_name: cartLine?.merchandise?.product?.title,
            affiliation: config.store.affiliationName,
            item_brand: cartLine?.merchandise?.product?.vendor,
            item_category: cartLine?.merchandise?.product?.type,
            item_variant: cartLine?.merchandise?.title,
            price: cartLine?.merchandise?.price?.amount,
            quantity: cartLine?.quantity
        };
        googleAnalyticsProducts.push(productInfo);

        // GAds (dynamic remarketing) - get the product info
        let remarketingItem = {
            id: googleProductId,
            google_business_vertical: config.remarketingGoogleAds.googleBusinessVertical
        };
        googleAdsProducts.push(remarketingItem);

        // construct the data layer object:
        const dataLayerObj = {
            event: 'add_to_cart',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                currency: cartLine?.cost?.totalAmount?.currencyCode,
                value: cartLine?.cost?.totalAmount?.amount,
                items: googleAnalyticsProducts
            }
        }   
        
        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            dataLayerObj.googleAdsDynamicRemarketing = {
                value: cartLine?.cost?.totalAmount?.amount, 
                items: googleAdsProducts
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // Meta Ads (dynamic remarketing)
        if (config.remarketingMetaAds.enabled) {
            dataLayerObj.metaAdsDynamicRemarketing = {
                content_category: cartLine?.merchandise?.product?.type,
                content_name: cartLine?.merchandise?.product?.title, 
                content_ids: [googleProductId],
                value: cartLine?.merchandise?.price?.amount,
                currency: cartLine?.merchandise?.price?.currencyCode
            }
            safePush({ 'metaAdsDynamicRemarketing': null });
        }

        // Pinterest Ads (dynamic remarketing)
        if (config.remarketingPinterestAds.enabled) {
            dataLayerObj.pinterestAdsDynamicRemarketing = {
                product_id: googleProductId,
                product_category: cartLine?.merchandise?.product?.type,
                currency: cartLine?.merchandise?.price?.currencyCode,
                value: cartLine?.merchandise?.price?.amount
            }
            safePush({ 'pinterestAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF ADD TO CART *************** */

/* *************** VIEW CART *************** */
if (config.conversionTracking.trackViewCart) {
    analytics.subscribe('cart_viewed', (event) => {

        const eventContextData = event.context?.document;
        const cart = event.data?.cart;
        let googleAnalyticsProducts = [];
        let googleAdsProducts = [];

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', cart);

        // loop through the products:
        cart?.lines?.forEach(function (item, index) {

            // Get the unified Product ID based on config.googleProductIdType
            const googleProductId = getProductId(
                item.merchandise,
                config.conversionTracking.googleProductIdType,
                config.remarketingGoogleAds.productIdPrefix,
                config.remarketingGoogleAds.remarketingCountryCode
            );

            pixelLog('>>> PIXEL: Generated Google Product ID: ', googleProductId);

            // GA4 - get the product info
            let lineItem = {
                item_id: googleProductId,
                item_name: item.merchandise?.product?.title,
                affiliation: config.store.affiliationName,
                index: index,
                item_brand: item.merchandise?.product?.vendor,
                item_category: item.merchandise?.product?.type,
                item_variant: item.merchandise?.title,
                price: item.merchandise?.price?.amount,
                quantity: item.quantity
            };
            googleAnalyticsProducts.push(lineItem);

            // GAds (dynamic remarketing) - get the product info
            let remarketingItem = {
                id: googleProductId,
                google_business_vertical: config.remarketingGoogleAds.googleBusinessVertical
            };
            googleAdsProducts.push(remarketingItem);

        });

        // construct the data layer object:
        const dataLayerObj = {
            event: 'view_cart',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                currency: cart?.cost?.totalAmount?.currencyCode,
                value: cart?.cost?.totalAmount?.amount,
                items: googleAnalyticsProducts
            }
        }   

        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            dataLayerObj.googleAdsDynamicRemarketing = {
                value: cart?.cost?.totalAmount?.amount, 
                items: googleAdsProducts
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF VIEW CART *************** */

/* *************** REMOVE FROM CART *************** */
if (config.conversionTracking.trackRemoveFromCart) {
    analytics.subscribe('product_removed_from_cart', (event) => {

        const eventContextData = event.context?.document;
        const cartLine = event.data?.cartLine;
        let googleAnalyticsProducts = [];
        let googleAdsProducts = [];

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', cartLine);

        // Get the unified Product ID based on config.googleProductIdType
        const googleProductId = getProductId(
            cartLine?.merchandise,
            config.conversionTracking.googleProductIdType,
            config.remarketingGoogleAds.productIdPrefix,
            config.remarketingGoogleAds.remarketingCountryCode
        );

        pixelLog('>>> PIXEL: Generated Google Product ID: ', googleProductId);

        // GA4 - get the product info
        let productInfo = {
            item_id: googleProductId,
            item_name: cartLine?.merchandise?.product?.title,
            affiliation: config.store.affiliationName,
            item_brand: cartLine?.merchandise?.product?.vendor,
            item_category: cartLine?.merchandise?.product?.type,
            item_variant: cartLine?.merchandise?.title,
            price: cartLine?.merchandise?.price?.amount,
            quantity: cartLine?.quantity
        };
        googleAnalyticsProducts.push(productInfo);

        // GAds (dynamic remarketing) - get the product info
        let remarketingItem = {
            id: googleProductId,
            google_business_vertical: config.remarketingGoogleAds.googleBusinessVertical
        };
        googleAdsProducts.push(remarketingItem);

        // construct the data layer object:
        const dataLayerObj = {
            event: 'remove_from_cart',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                currency: cartLine?.cost?.totalAmount?.currencyCode,
                value: cartLine?.cost?.totalAmount?.amount,
                items: googleAnalyticsProducts
            }
        }

        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            dataLayerObj.googleAdsDynamicRemarketing = {
                value: cartLine?.cost?.totalAmount?.amount, 
                items: googleAdsProducts
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF REMOVE FROM CART *************** */

/* *************** HELPER FUNCTION TO PROCESS CHECKOUT PRODUCTS *************** */
const processCheckoutProducts = (items) => {
    let orderCoupon = []; // to hold the discount titles
    let googleAnalyticsProducts = [];
    let googleAdsProducts = [];

    if (items) {
        items.forEach((item, index) => {
            let itemDiscountAmount = 0;

            // Process discounts for this item
            item.discountAllocations?.forEach((allocation) => {
                const discount = allocation.discountApplication;

                // Capture the discount title if not already added
                if (discount.title && !orderCoupon.includes(discount.title)) {
                    orderCoupon.push(discount.title);
                }

                // Accumulate discount amount for the item
                const allocationAmount = allocation.amount.amount;
                itemDiscountAmount += allocationAmount;
            });

            // GA4: Calculate price after discount
            const itemPrice = item.variant.price.amount;
            // Ensure priceAfterDiscount is never negative
            let priceAfterDiscount = itemPrice - (itemDiscountAmount / item.quantity);
            priceAfterDiscount = Math.max(priceAfterDiscount, 0);


            // Get the unified Product ID based on config.googleProductIdType
            const googleProductId = getProductId(
                item.variant,
                config.conversionTracking.googleProductIdType,
                config.remarketingGoogleAds.productIdPrefix,
                config.remarketingGoogleAds.remarketingCountryCode
            );

            pixelLog('>>> PIXEL: Generated Google Product ID: ', googleProductId);

            // GA4 - get the product info
            let lineItem = {
                item_id: googleProductId,
                item_name: item.variant?.product?.title,
                affiliation: config.store.affiliationName,
                coupon: orderCoupon.join(',') || undefined,
                discount: itemDiscountAmount / item.quantity,
                index: index,
                item_brand: item.variant?.product?.vendor,
                item_category: item.variant?.product?.type,
                item_variant: item.variant?.title,
                price: priceAfterDiscount,
                quantity: item.quantity
            };
            googleAnalyticsProducts.push(lineItem);

            // GAds (dynamic remarketing) - get the product info
            let remarketingItem = {
                id: googleProductId,
                google_business_vertical: config.remarketingGoogleAds.googleBusinessVertical
            };
            googleAdsProducts.push(remarketingItem);

        });
    }

    return {
        items: googleAnalyticsProducts,
        orderCouponString: orderCoupon.join(','),
        googleAdsItems: googleAdsProducts
    };
};

/* *************** END OF HELPER FUNCTION TO PROCESS CHECKOUT PRODUCTS *************** */

/* *************** BEGIN CHECKOUT *************** */
if (config.conversionTracking.trackBeginCheckout) {
    analytics.subscribe('checkout_started', (event) => {

        const eventContextData = event.context?.document;
        const checkout = event.data?.checkout;
        let orderDiscountAmount = checkout.discountsAmount?.amount || 0;
        let totalPrice = checkout.totalPrice.amount;
        let shipping = checkout?.shippingLine?.price?.amount || 0;
        let tax = checkout?.totalTax?.amount || 0;

        // Extract the discount that applies to the shipping separately
        let shippingDiscount = checkout.delivery?.selectedDeliveryOptions?.reduce((total, option) => {
            let originalCost = option.cost?.amount || 0;
            let discountedCost = option.costAfterDiscounts?.amount || 0;
            return total + (originalCost - discountedCost);
        }, 0) || 0;

        // Total order value calculation
        let totalOrderValue = totalPrice - shipping - tax;

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', checkout);
        pixelLog('>>> PIXEL: discountsAmount: ' + orderDiscountAmount);
        pixelLog('>>> PIXEL: shipping discount: ' + shippingDiscount);
        pixelLog('>>> PIXEL: totalPrice: ' + totalPrice);
        pixelLog('>>> PIXEL: shipping: ' + shipping);
        pixelLog('>>> PIXEL: tax: ' + tax);
        pixelLog('>>> PIXEL: totalOrderValue: ' + totalOrderValue);

        // Process products for GA4
        const processedProducts = processCheckoutProducts(checkout?.lineItems);

        // Construct the data layer object:
        const dataLayerObj = {
            event: 'begin_checkout',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                currency: checkout?.currencyCode,
                value: totalOrderValue,
                coupon: checkout.discountApplications?.map(d => d.title).filter(Boolean).join(',') || undefined,
                discount: orderDiscountAmount,
                items: processedProducts.items
            }
        }

        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            dataLayerObj.googleAdsDynamicRemarketing = {
                value: totalOrderValue,
                items: processedProducts.googleAdsItems
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // Meta Ads (dynamic remarketing)
        if (config.remarketingMetaAds.enabled) {
            dataLayerObj.metaAdsDynamicRemarketing = {
                content_ids: processedProducts.items.map(item => item.item_id),
                value: totalOrderValue,
                currency: checkout?.currencyCode
            }
            safePush({ 'metaAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF BEGIN CHECKOUT *************** */

/* *************** ADD SHIPPING INFO *************** */
if (config.conversionTracking.trackAddShippingInfo) {
    analytics.subscribe('checkout_shipping_info_submitted', (event) => {

        const eventContextData = event.context?.document;
        const checkout = event.data?.checkout;
        let orderDiscountAmount = checkout.discountsAmount?.amount || 0;
        let totalPrice = checkout.totalPrice.amount;
        let shipping = checkout?.shippingLine?.price?.amount || 0;
        let tax = checkout?.totalTax?.amount || 0;

        // Extract the discount that applies to the shipping separately
        let shippingDiscount = checkout.delivery?.selectedDeliveryOptions?.reduce((total, option) => {
            let originalCost = option.cost?.amount || 0;
            let discountedCost = option.costAfterDiscounts?.amount || 0;
            return total + (originalCost - discountedCost);
        }, 0) || 0;

        // Total order value calculation
        let totalOrderValue = totalPrice - shipping - tax;

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', checkout);
        pixelLog('>>> PIXEL: discountsAmount: ' + orderDiscountAmount);
        pixelLog('>>> PIXEL: shipping discount: ' + shippingDiscount);
        pixelLog('>>> PIXEL: totalPrice: ' + totalPrice);
        pixelLog('>>> PIXEL: shipping: ' + shipping);
        pixelLog('>>> PIXEL: tax: ' + tax);
        pixelLog('>>> PIXEL: totalOrderValue: ' + totalOrderValue);

        // Process products for GA4
        const processedProducts = processCheckoutProducts(checkout?.lineItems);

        // construct the data layer object:
        const dataLayerObj = {
            event: 'add_shipping_info',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                currency: checkout?.currencyCode,
                value: totalOrderValue,
                coupon: checkout.discountApplications?.map(d => d.title).filter(Boolean).join(',') || undefined,
                discount: orderDiscountAmount,
                shipping_tier: checkout.delivery?.selectedDeliveryOptions?.[0]?.title || undefined,
                items: processedProducts.items
            }
        }

        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            dataLayerObj.googleAdsDynamicRemarketing = {
                value: totalOrderValue,
                items: processedProducts.googleAdsItems
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF ADD SHIPPING INFO *************** */

/* *************** ADD PAYMENT INFO *************** */
if (config.conversionTracking.trackAddPaymentInfo) {
    analytics.subscribe('payment_info_submitted', (event) => {

        const eventContextData = event.context?.document;
        const checkout = event.data?.checkout;
        let orderDiscountAmount = checkout.discountsAmount?.amount || 0;
        let totalPrice = checkout.totalPrice.amount;
        let shipping = checkout?.shippingLine?.price?.amount || 0;
        let tax = checkout?.totalTax?.amount || 0;

        // Extract the discount that applies to the shipping separately
        let shippingDiscount = checkout.delivery?.selectedDeliveryOptions?.reduce((total, option) => {
            let originalCost = option.cost?.amount || 0;
            let discountedCost = option.costAfterDiscounts?.amount || 0;
            return total + (originalCost - discountedCost);
        }, 0) || 0;

        // Total order value calculation
        let totalOrderValue = totalPrice - shipping - tax;

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', checkout);
        pixelLog('>>> PIXEL: discountsAmount: ' + orderDiscountAmount);
        pixelLog('>>> PIXEL: shipping discount: ' + shippingDiscount);
        pixelLog('>>> PIXEL: totalPrice: ' + totalPrice);
        pixelLog('>>> PIXEL: shipping: ' + shipping);
        pixelLog('>>> PIXEL: tax: ' + tax);
        pixelLog('>>> PIXEL: totalOrderValue: ' + totalOrderValue);

        // Process products for GA4
        const processedProducts = processCheckoutProducts(checkout?.lineItems);

        // construct the data layer object:
        const dataLayerObj = {
            event: 'add_payment_info',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                currency: checkout?.currencyCode,
                value: totalOrderValue,
                coupon: checkout.discountApplications?.map(d => d.title).filter(Boolean).join(',') || undefined,
                discount: orderDiscountAmount,
                items: processedProducts.items
            }
        }

        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            dataLayerObj.googleAdsDynamicRemarketing = {
                value: totalOrderValue,
                items: processedProducts.googleAdsItems
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF ADD PAYMENT INFO *************** */

/* *************** PURCHASE *************** */
if (config.conversionTracking.trackPurchase) {
    analytics.subscribe('checkout_completed', (event) => {

        const eventContextData = event.context?.document;
        const checkout = event.data?.checkout;
        let orderDiscountAmount = checkout.discountsAmount?.amount || 0;
        let totalPrice = checkout.totalPrice.amount;
        let shipping = checkout?.shippingLine?.price?.amount || 0;
        let tax = checkout?.totalTax?.amount || 0;

        // Extract the discount that applies to the shipping separately
        let shippingDiscount = checkout.delivery?.selectedDeliveryOptions?.reduce((total, option) => {
            let originalCost = option.cost?.amount || 0;
            let discountedCost = option.costAfterDiscounts?.amount || 0;
            return total + (originalCost - discountedCost);
        }, 0) || 0;

        // Total order value calculation
        let totalOrderValue = totalPrice - shipping - tax;

        pixelLog('>>> PIXEL: Event data for ' + event.name + ': ', event.data, init);
        pixelLog('>>> PIXEL: Ecommerce object for ' + event.name + ': ', checkout);
        pixelLog('>>> PIXEL: discountsAmount: ' + orderDiscountAmount);
        pixelLog('>>> PIXEL: shipping discount: ' + shippingDiscount);
        pixelLog('>>> PIXEL: totalPrice: ' + totalPrice);
        pixelLog('>>> PIXEL: shipping: ' + shipping);
        pixelLog('>>> PIXEL: tax: ' + tax);
        pixelLog('>>> PIXEL: totalOrderValue: ' + totalOrderValue);

        // Determine the payment type
        const paymentType = checkout?.transactions?.[0]?.gateway || 'no payment type';

        // Process products for GA4, Google Ads, and Meta Ads
        const processedProducts = processCheckoutProducts(checkout?.lineItems);

        // Construct the data layer object
        const dataLayerObj = {
            event: 'purchase',
            page_location: eventContextData?.location?.href,
            page_referrer: eventContextData?.referrer,
            page_title: eventContextData?.title,
            ecommerce: {
                transaction_id: checkout?.order?.id,
                currency: checkout?.currencyCode,
                value: totalOrderValue,
                tax: tax,
                shipping: shipping,
                shipping_tier: checkout.delivery?.selectedDeliveryOptions?.[0]?.title || undefined,
                coupon: checkout.discountApplications?.map(d => d.title).filter(Boolean).join(',') || undefined,
                discount: orderDiscountAmount,
                payment_type: paymentType,
                items: processedProducts.items
            },
            user_data: {
                email: checkout?.email,
                phone: checkout?.billingAddress?.phone,
                firstName: checkout?.billingAddress?.firstName,
                lastName: checkout?.billingAddress?.lastName,
                country: checkout?.billingAddress?.countryCode,
                zip: checkout?.billingAddress?.zip
            }
        };

        // GAds (dynamic remarketing)
        if (config.remarketingGoogleAds.enabled) {
            dataLayerObj.googleAdsDynamicRemarketing = {
                value: totalOrderValue,
                items: processedProducts.googleAdsItems
            }
            safePush({ 'googleAdsDynamicRemarketing': null });
        }

        // Meta Ads (dynamic remarketing)
        if (config.remarketingMetaAds.enabled) {
            dataLayerObj.metaAdsDynamicRemarketing = {
                content_ids: processedProducts.items.map(item => item.item_id),
                value: totalOrderValue,
                currency: checkout?.currencyCode
            }
            safePush({ 'metaAdsDynamicRemarketing': null });
        }

        // Pinterest Ads (dynamic remarketing)
        if (config.remarketingPinterestAds.enabled) {
            dataLayerObj.pinterestAdsDynamicRemarketing = {
                order_id: checkout?.order?.id,
                order_value: totalOrderValue,
                currency: checkout?.currencyCode,
                order_quantity: processedProducts.items.reduce((sum, item) => sum + item.quantity, 0),
                line_items: processedProducts.items.map(item => ({
                    product_category: item.item_category,
                    product_name: item.item_name,
                    product_id: item.item_id,
                    product_price: item.price,
                    product_quantity: item.quantity
                }))
            }
            safePush({ 'pinterestAdsDynamicRemarketing': null });
        }

        // push the content to the dataLayer:
        safePush({ 'ecommerce': null });
        safePush({ 'user_data': null });
        safePush(dataLayerObj);
        pixelLog('>>> PIXEL: safePush function called with: ', dataLayerObj);
    });
}
/* *************** END OF PURCHASE *************** */
