(() => {
  function formatMoney(cents, currency) {
    return new Intl.NumberFormat(document.documentElement.lang || 'en', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(Number(cents) / 100);
  }

  function getProductData(trigger) {
    const productId = trigger.dataset.productId;

    const section = trigger.closest('.custom-product-grid-section');

    if (!section) {
      return null;
    }

    const productScript = section.querySelector(
      `[data-product-data="${productId}"]`
    );

    if (!productScript) {
      console.error('Product data not found:', productId);
      return null;
    }

    try {
      return JSON.parse(productScript.textContent);
    } catch (error) {
      console.error('Could not parse product data:', error);
      return null;
    }
  }

  function initProductGrid(section) {
    if (!section || section.dataset.productGridInitialized === 'true') {
      return;
    }

    section.dataset.productGridInitialized = 'true';

    const modal = section.querySelector('[data-product-modal]');

    if (!modal) {
      return;
    }

    const modalImage = modal.querySelector('[data-modal-image]');
    const modalTitle = modal.querySelector('[data-modal-title]');
    const modalPrice = modal.querySelector('[data-modal-price]');
    const modalDescription = modal.querySelector('[data-modal-description]');
    const modalOptions = modal.querySelector('[data-modal-options]');
    const modalError = modal.querySelector('[data-modal-error]');
    const addToCartButton = modal.querySelector('[data-add-to-cart]');

    let currentProduct = null;
    let selectedOptions = [];
    let selectedVariant = null;

    function getVariant() {
      if (!currentProduct?.variants) {
        return null;
      }

      return currentProduct.variants.find((variant) => {
        return variant.options.every((option, index) => {
          return option === selectedOptions[index];
        });
      }) || null;
    }

    function updateVariant() {
      selectedVariant = getVariant();

      if (!selectedVariant) {
        addToCartButton.disabled = true;
        return;
      }

      addToCartButton.disabled = !selectedVariant.available;

      addToCartButton.querySelector('span').textContent =
        selectedVariant.available ? 'ADD TO CART' : 'SOLD OUT';
    }

    function renderOptions() {
      modalOptions.innerHTML = '';

      if (!currentProduct.options?.length) {
        return;
      }

      currentProduct.options.forEach((optionName, optionIndex) => {
        const values = [
          ...new Set(
            currentProduct.variants
              .map((variant) => variant.options[optionIndex])
              .filter(Boolean)
          )
        ];

        if (!values.length) {
          return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'gift-product-modal__option';

        const label = document.createElement('span');
        label.className = 'gift-product-modal__option-label';
        label.textContent = optionName;

        wrapper.appendChild(label);

        if (optionIndex === 0) {
          const valuesWrapper = document.createElement('div');
          valuesWrapper.className =
            'gift-product-modal__option-values';

          values.forEach((value) => {
            const button = document.createElement('button');

            button.type = 'button';
            button.className =
              'gift-product-modal__option-value';
            button.textContent = value;

            button.addEventListener('click', () => {
              selectedOptions[optionIndex] = value;

              valuesWrapper
                .querySelectorAll(
                  '.gift-product-modal__option-value'
                )
                .forEach((item) => {
                  item.classList.toggle(
                    'is-selected',
                    item === button
                  );
                });

              updateVariant();
            });

            valuesWrapper.appendChild(button);
          });

          wrapper.appendChild(valuesWrapper);
        } else {
          const select = document.createElement('select');

          select.className =
            'gift-product-modal__option-select';

          const placeholder = document.createElement('option');

          placeholder.value = '';
          placeholder.textContent =
            `Choose ${optionName.toLowerCase()}`;

          select.appendChild(placeholder);

          values.forEach((value) => {
            const option = document.createElement('option');

            option.value = value;
            option.textContent = value;

            select.appendChild(option);
          });

          select.addEventListener('change', () => {
            selectedOptions[optionIndex] = select.value;
            updateVariant();
          });

          wrapper.appendChild(select);
        }

        modalOptions.appendChild(wrapper);
      });
    }

    function openModal(trigger) {
      currentProduct = getProductData(trigger);

      if (!currentProduct) {
        return;
      }

      selectedOptions = [];
      selectedVariant = null;

      modalError.hidden = true;
      modalError.textContent = '';

      modalTitle.textContent = currentProduct.title;

      modalPrice.textContent = formatMoney(
        currentProduct.price,
        currentProduct.currency
      );

      modalDescription.innerHTML =
        currentProduct.description || '';

      if (currentProduct.featured_image) {
        modalImage.src = currentProduct.featured_image.src;
        modalImage.alt = currentProduct.title;
      }

      renderOptions();

      /*
       * Automatically select options that have only one value.
       */
      currentProduct.options?.forEach((optionName, index) => {
        const values = [
          ...new Set(
            currentProduct.variants
              .map((variant) => variant.options[index])
              .filter(Boolean)
          )
        ];

        if (values.length === 1) {
          selectedOptions[index] = values[0];

          const optionWrappers =
            modalOptions.querySelectorAll(
              '.gift-product-modal__option'
            );

          const wrapper = optionWrappers[index];

          if (!wrapper) {
            return;
          }

          const button = wrapper.querySelector(
            '.gift-product-modal__option-value'
          );

          const select = wrapper.querySelector(
            '.gift-product-modal__option-select'
          );

          if (button) {
            button.classList.add('is-selected');
          }

          if (select) {
            select.value = values[0];
          }
        }
      });

      updateVariant();

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');

      document.body.classList.add(
        'gift-product-modal-open'
      );
    }

    function closeModal() {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');

      document.body.classList.remove(
        'gift-product-modal-open'
      );

      currentProduct = null;
      selectedVariant = null;
    }

    /*
     * Event delegation.
     * This also works when Shopify Theme Editor re-renders
     * the section.
     */
    section.addEventListener('click', (event) => {
      const trigger = event.target.closest(
        '[data-product-trigger]'
      );

      if (trigger) {
        event.preventDefault();
        openModal(trigger);
        return;
      }

      const closeButton = event.target.closest(
        '[data-modal-close]'
      );

      if (closeButton) {
        event.preventDefault();
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (
        event.key === 'Escape' &&
        modal.classList.contains('is-open')
      ) {
        closeModal();
      }
    });

    addToCartButton.addEventListener('click', () => {
      if (!selectedVariant) {
        modalError.textContent =
          'Please select all product options.';

        modalError.hidden = false;
        return;
      }

      modalError.textContent =
        `Selected variant: ${selectedVariant.id}`;

      modalError.hidden = false;
    });
  }

  function initialize() {
    document
      .querySelectorAll('.custom-product-grid-section')
      .forEach(initProductGrid);
  }

  /*
   * Normal storefront.
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  /*
   * Shopify Theme Editor.
   */
  document.addEventListener('shopify:section:load', (event) => {
    const section = event.target;

    if (
      section.matches &&
      section.matches('.custom-product-grid-section')
    ) {
      initProductGrid(section);
    }
  });
})();