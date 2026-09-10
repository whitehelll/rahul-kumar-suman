(() => {
  'use strict';

  /**
     * @type {{ options: any[]; handle: string; } | null}
     */
  let currentProduct = null;
  let selectedOptions = {};
  /**
     * @type {{ options: any[]; id: any; } | null}
     */
  let selectedVariant = null;

  /**
     * @param {any} cents
     * @param {any} currency
     */
  function formatMoney(cents, currency) {
    try {
      return new Intl.NumberFormat(
        document.documentElement.lang || 'en',
        {
          style: 'currency',
          currency: currency || 'EUR'
        }
      ).format(Number(cents) / 100);
    } catch (error) {
      return `${Number(cents) / 100}`;
    }
  }

  /**
     * @param {Element} trigger
     */
  function getProductData(trigger) {
    // @ts-ignore
    const productId = trigger.dataset.productId;

    const productDataElement =
      document.querySelector(
        `[data-product-data="${productId}"]`
      );

    if (!productDataElement) {
      return null;
    }

    try {
      return JSON.parse(
        productDataElement.textContent
      );
    } catch (error) {
      console.error(
        'Unable to read product data:',
        error
      );

      return null;
    }
  }

  /**
     * @param {{ options: any[]; }} product
     * @param {string} optionName
     */
  function getOptionIndex(product, optionName) {
    if (!product || !product.options) {
      return -1;
    }

    return product.options.findIndex(
      (option) =>
        option.name.toLowerCase() ===
        optionName.toLowerCase()
    );
  }

  /**
     * @param {{ options: any[]; handle: string; } | null} product
     */
  function getVariant(product) {
    // @ts-ignore
    if (!product || !product.variants) {
      return null;
    }

    return (
      // @ts-ignore
      product.variants.find((variant) => {
        if (!variant.available) {
          return false;
        }

        return product.options.every(
          (option, index) => {
            return (
              variant.options[index] ===
              // @ts-ignore
              selectedOptions[option.name]
            );
          }
        );
      }) || null
    );
  }

  /**
     * @param {{ variants: any[]; }} product
     */
  function getFirstAvailableVariant(product) {
    if (!product || !product.variants) {
      return null;
    }

    return (
      product.variants.find(
        (variant) => variant.available
      ) || product.variants[0]
    );
  }

  function updateSelectedVariant() {
    selectedVariant = getVariant(currentProduct);

    const addButton =
      document.querySelector('[data-add-to-cart]');

    if (!addButton) {
      return;
    }

    if (selectedVariant) {
      // @ts-ignore
      addButton.disabled = false;
    } else {
      // @ts-ignore
      addButton.disabled = true;
    }
  }

  /**
     * @param {{ name: string | null; values: any[]; }} option
     * @param {number} index
     */
  function renderOption(option, index) {
    const container =
      document.querySelector('[data-modal-options]');

    if (!container) {
      return;
    }

    const optionWrapper =
      document.createElement('div');

    optionWrapper.className =
      'gift-product-modal__option';

    const label =
      document.createElement('label');

    label.className =
      'gift-product-modal__option-label';

    label.textContent = option.name;

    optionWrapper.appendChild(label);

    /*
     * Color options are displayed as buttons.
     * Other options are displayed as select fields.
     */
    if (
      // @ts-ignore
      option.name.toLowerCase().includes('color')
    ) {
      const buttonContainer =
        document.createElement('div');

      buttonContainer.className =
        'gift-product-modal__option-buttons';

      option.values.forEach((value) => {
        const button =
          document.createElement('button');

        button.type = 'button';

        button.className =
          'gift-product-modal__option-button';

        button.textContent = value;

        if (
          // @ts-ignore
          selectedOptions[option.name] === value
        ) {
          button.classList.add('is-selected');
        }

        button.addEventListener(
          'click',
          () => {
            // @ts-ignore
            selectedOptions[option.name] = value;

            renderOptions();
            updateSelectedVariant();
          }
        );

        buttonContainer.appendChild(button);
      });

      optionWrapper.appendChild(
        buttonContainer
      );
    } else {
      const select =
        document.createElement('select');

      select.className =
        'gift-product-modal__select';

      option.values.forEach((value) => {
        const optionElement =
          document.createElement('option');

        optionElement.value = value;
        optionElement.textContent = value;

        if (
          // @ts-ignore
          selectedOptions[option.name] === value
        ) {
          optionElement.selected = true;
        }

        select.appendChild(optionElement);
      });

      select.addEventListener(
        'change',
        (event) => {
          // @ts-ignore
          selectedOptions[option.name] =
            // @ts-ignore
            event.target.value;

          updateSelectedVariant();
        }
      );

      optionWrapper.appendChild(select);
    }

    container.appendChild(optionWrapper);
  }

  function renderOptions() {
    const container =
      document.querySelector('[data-modal-options]');

    if (!container || !currentProduct) {
      return;
    }

    container.innerHTML = '';

    currentProduct.options.forEach(
      (option, index) => {
        renderOption(option, index);
      }
    );
  }

  /**
     * @param {{
         unknown; options: any[]; handle: string; 
} | null} product
     */
  function openModal(product) {
    const modal =
      document.querySelector('[data-product-modal]');

    if (!modal || !product) {
      return;
    }

    currentProduct = product;

    selectedOptions = {};

    /*
     * Start with the first available variant.
     */
    const firstVariant =
      // @ts-ignore
      getFirstAvailableVariant(product);

    if (firstVariant) {
      product.options.forEach(
        (option, index) => {
          // @ts-ignore
          selectedOptions[option.name] =
            firstVariant.options[index];
        }
      );
    }

    selectedVariant = firstVariant;

    const title =
      modal.querySelector('[data-modal-title]');

    const price =
      modal.querySelector('[data-modal-price]');

    const description =
      modal.querySelector(
        '[data-modal-description]'
      );

    const image =
      modal.querySelector('[data-modal-image]');

    const error =
      modal.querySelector('[data-modal-error]');

    if (title) {
      // @ts-ignore
      title.textContent = product.title;
    }

    if (price) {
      const section =
        document.querySelector(
          '.custom-product-grid-section'
        );

      const currency =
        // @ts-ignore
        section?.dataset.currency || 'EUR';

      price.textContent =
        formatMoney(
          product.price,
          currency
        );
    }

    if (description) {
      description.innerHTML =
        // @ts-ignore
        product.description || '';
    }

    if (image) {
      const trigger =
        document.querySelector(
          // @ts-ignore
          `[data-product-id="${product.id}"]`
        );

      const productImage =
        trigger?.querySelector(
          '.custom-product-grid__image'
        );

      if (productImage) {
        // @ts-ignore
        image.src = productImage.src;
        // @ts-ignore
        image.alt = product.title;
      }
    }

    if (error) {
      // @ts-ignore
      error.hidden = true;
      error.textContent = '';
    }

    renderOptions();
    updateSelectedVariant();

    modal.classList.add('is-open');
    modal.setAttribute(
      'aria-hidden',
      'false'
    );

    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal =
      document.querySelector('[data-product-modal]');

    if (!modal) {
      return;
    }

    modal.classList.remove('is-open');

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

    document.body.style.overflow = '';
  }

  async function getSoftWinterJacketVariant() {
    try {
      const response =
        await fetch(
          `${window.Shopify.routes.root}products/dark-winter-jacket.js`
        );

      if (!response.ok) {
        throw new Error(
          'Unable to load Soft Winter Jacket'
        );
      }

      const product =
        await response.json();

      /*
       * Find the Black + Medium variant.
       *
       * The CSV uses:
       * Size = M
       * Color = Black
       *
       * We therefore accept both "M" and "Medium".
       */
      const variant =
        product.variants.find(function (/** @type {{ options: any[]; }} */ item) {
            const options = item.options.map(
                (value) => String(value).toLowerCase()
            );

            const hasBlack = options.includes('black');

            const hasMedium = options.includes('m') ||
                options.includes('medium');

            return hasBlack && hasMedium;
        });

      return variant || null;
    } catch (error) {
      console.error(
        'Soft Winter Jacket error:',
        error
      );

      return null;
    }
  }

  function requiresSoftWinterJacket() {
    if (!selectedVariant) {
      return false;
    }

    const options =
      selectedVariant.options.map(
        (value) =>
          String(value).toLowerCase()
      );

    const hasBlack =
      options.includes('black');

    const hasMedium =
      options.includes('m') ||
      options.includes('medium');

    return hasBlack && hasMedium;
  }

  async function addToCart() {
    const addButton =
      document.querySelector('[data-add-to-cart]');

    const errorElement =
      document.querySelector('[data-modal-error]');

    if (!selectedVariant) {
      if (errorElement) {
        errorElement.textContent =
          'Please select an available variant.';

        // @ts-ignore
        errorElement.hidden = false;
      }

      return;
    }

    // @ts-ignore
    addButton.disabled = true;

    if (errorElement) {
      // @ts-ignore
      errorElement.hidden = true;
      errorElement.textContent = '';
    }

    try {
      const items = [
        {
          id: selectedVariant.id,
          quantity: 1
        }
      ];

      /*
       * Special assessment requirement:
       *
       * If the selected variant has
       * Black + Medium options,
       * automatically add Soft Winter Jacket.
       */
      if (
        requiresSoftWinterJacket() &&
        // @ts-ignore
        currentProduct.handle !==
          'dark-winter-jacket'
      ) {
        const jacketVariant =
          await getSoftWinterJacketVariant();

        if (jacketVariant) {
          items.push({
            id: jacketVariant.id,
            quantity: 1
          });
        }
      }

      const response =
        await fetch(
          `${window.Shopify.routes.root}cart/add.js`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
              Accept:
                'application/json'
            },

            body: JSON.stringify({
              items
            })
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.description ||
            'Unable to add product to cart.'
        );
      }

      /*
       * Successfully added.
       */
      closeModal();

      /*
       * Refresh the cart drawer/cart count.
       */
      document.dispatchEvent(
        new CustomEvent(
          'cart:updated',
          {
            detail: data
          }
        )
      );

      /*
       * Give the customer a visible confirmation.
       */
      alert('Product added to cart.');
    } catch (error) {
      console.error(
        'Add to cart error:',
        error
      );

      if (errorElement) {
        errorElement.textContent =
          // @ts-ignore
          error.message ||
          'Something went wrong. Please try again.';

        // @ts-ignore
        errorElement.hidden = false;
      }
    } finally {
      // @ts-ignore
      addButton.disabled = false;
    }
  }

  function initProductGrid() {
    const triggers =
      document.querySelectorAll(
        '[data-product-trigger]'
      );

    /*
     * Avoid attaching duplicate listeners.
     */
    triggers.forEach((trigger) => {
      // @ts-ignore
      if (trigger.dataset.initialized === 'true') {
        return;
      }

      // @ts-ignore
      trigger.dataset.initialized = 'true';

      trigger.addEventListener(
        'click',
        () => {
          const product =
            getProductData(trigger);

          if (product) {
            openModal(product);
          }
        }
      );
    });

    const modal =
      document.querySelector('[data-product-modal]');

    if (!modal) {
      return;
    }

    if (
      // @ts-ignore
      modal.dataset.initialized !== 'true'
    ) {
      // @ts-ignore
      modal.dataset.initialized = 'true';

      modal
        .querySelectorAll('[data-modal-close]')
        .forEach((element) => {
          element.addEventListener(
            'click',
            closeModal
          );
        });

      const addButton =
        modal.querySelector(
          '[data-add-to-cart]'
        );

      if (addButton) {
        addButton.addEventListener(
          'click',
          addToCart
        );
      }
    }
  }

  /*
   * Normal page load.
   */
  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initProductGrid
    );
  } else {
    initProductGrid();
  }

  /*
   * Shopify Theme Editor dynamically reloads
   * sections, so initialise again when a
   * section is loaded.
   */
  document.addEventListener(
    'shopify:section:load',
    initProductGrid
  );

  /*
   * ESC closes the popup.
   */
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    }
  );
})();