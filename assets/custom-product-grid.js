(() => {
  "use strict";

  let currentProduct = null;
  let selectedOptions = {};
  let selectedVariant = null;
  let currentTrigger = null;

  /**
   * Format Shopify price.
   * Shopify product prices are returned in cents.
   */
  function formatMoney(cents, currency) {
    const value = Number(cents);

    if (!Number.isFinite(value)) {
      return "";
    }

    try {
      return new Intl.NumberFormat(document.documentElement.lang || "en", {
        style: "currency",
        currency: currency || "EUR",
      }).format(value / 100);
    } catch (error) {
      return `${(value / 100).toFixed(2)} ${currency || ""}`.trim();
    }
  }

  /**
   * Get product JSON belonging to a product trigger.
   *
   * Product data is rendered by custom-product-grid.liquid into a
   * type="application/json" script tag. Reading it locally avoids an
   * additional /products/{handle}.js request every time the popup opens.
   */
  function getProductData(trigger) {
    if (!trigger) {
      return null;
    }

    const productId = trigger.dataset.productId;

    if (!productId) {
      console.error("Product ID not found on product trigger.");
      return null;
    }

    const productDataElement = document.querySelector(
      `[data-product-data="${productId}"]`,
    );

    if (!productDataElement) {
      console.error("Product data not found for:", productId);
      return null;
    }

    try {
      const product = JSON.parse(productDataElement.textContent.trim());

      if (!product || !Array.isArray(product.variants)) {
        console.error("Invalid product data for:", productId);
        return null;
      }

      console.log("Loaded product:", product);

      return product;
    } catch (error) {
      console.error("Invalid product JSON:", error);

      return null;
    }
  }

  /**
   * Convert Shopify product options into a consistent format.
   *
   * Supported structures:
   *
   * 1. Shopify:
   *    options: ["Size", "Color"]
   *
   * 2. Custom:
   *    options: [
   *      { name: "Size", values: ["XS", "S", "M"] }
   *    ]
   */
  function getProductOptions(product) {
    if (!product) {
      return [];
    }

    /*
     * If options already contain objects with names and values,
     * use that structure.
     */
    if (
      Array.isArray(product.options) &&
      product.options.length > 0 &&
      typeof product.options[0] === "object"
    ) {
      return product.options
        .map((option) => ({
          name: option.name || "",
          values: Array.isArray(option.values) ? option.values : [],
        }))
        .filter((option) => option.name);
    }

    /*
     * Shopify product JSON can provide option names as strings.
     *
     * Example:
     * ["Size", "Color"]
     *
     * Build the available values from the variants.
     */
    if (
      Array.isArray(product.options) &&
      product.options.length > 0 &&
      Array.isArray(product.variants)
    ) {
      return product.options.map((optionName, index) => {
        const values = [
          ...new Set(
            product.variants
              .map((variant) => variant.options?.[index])
              .filter(Boolean),
          ),
        ];

        return {
          name: String(optionName),
          values,
        };
      });
    }

    /*
     * Fallback for product data where option names are unavailable.
     */
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const optionCount = Array.isArray(product.variants[0].options)
        ? product.variants[0].options.length
        : 0;

      const options = [];

      for (let index = 0; index < optionCount; index += 1) {
        const values = [
          ...new Set(
            product.variants
              .map((variant) => variant.options?.[index])
              .filter(Boolean),
          ),
        ];

        let name = `Option ${index + 1}`;

        if (index === 0) {
          name = "Size";
        }

        if (index === 1) {
          name = "Color";
        }

        options.push({
          name,
          values,
        });
      }

      return options;
    }

    return [];
  }

  /**
   * Get the first available variant.
   */
  function getFirstAvailableVariant(product) {
    if (!product || !Array.isArray(product.variants)) {
      return null;
    }

    return (
      product.variants.find((variant) => variant.available) ||
      product.variants[0] ||
      null
    );
  }

  /**
   * Find a variant matching the currently selected options.
   */
  function getVariant(product) {
    if (!product || !Array.isArray(product.variants)) {
      return null;
    }

    const options = getProductOptions(product);

    /*
     * If there are no selectable options, return
     * the first available variant.
     */
    if (options.length === 0) {
      return getFirstAvailableVariant(product);
    }

    return (
      product.variants.find((variant) => {
        if (!variant) {
          return false;
        }

        /*
         * Don't allow an unavailable variant.
         */
        if (variant.available === false) {
          return false;
        }

        if (!Array.isArray(variant.options)) {
          return false;
        }

        return options.every((option, index) => {
          return (
            String(variant.options[index] ?? "") ===
            String(selectedOptions[option.name] ?? "")
          );
        });
      }) || null
    );
  }

  /**
   * Update selected variant and Add to Cart button state.
   */
  function updateSelectedVariant() {
    selectedVariant = getVariant(currentProduct);

    const modal = document.querySelector("[data-product-modal]");

    if (!modal) {
      return;
    }

    const addButton = modal.querySelector("[data-add-to-cart]");

    const priceElement = modal.querySelector("[data-modal-price]");

    if (selectedVariant) {
      if (addButton) {
        addButton.disabled = false;
      }

      if (priceElement) {
        const section = document.querySelector(
          ".custom-product-grid-section",
        );

        const currency = section?.dataset.currency || "EUR";

        priceElement.textContent = formatMoney(
          selectedVariant.price,
          currency,
        );
      }
    } else {
      if (addButton) {
        addButton.disabled = true;
      }
    }
  }

  /**
   * Render one product option.
   */
  function renderOption(option) {
    const container = document.querySelector("[data-modal-options]");

    if (!container || !option) {
      return;
    }

    const optionWrapper = document.createElement("div");

    optionWrapper.className = "gift-product-modal__option";

    const label = document.createElement("label");

    label.className = "gift-product-modal__option-label";

    label.textContent = option.name;

    optionWrapper.appendChild(label);

    /*
     * Color is displayed as buttons.
     */
    if (option.name.toLowerCase().includes("color")) {
      const buttonContainer = document.createElement("div");

      buttonContainer.className =
        "gift-product-modal__option-buttons";

      option.values.forEach((value) => {
        const button = document.createElement("button");

        button.type = "button";

        button.className =
          "gift-product-modal__option-button";

        button.textContent = value;

        if (selectedOptions[option.name] === value) {
          button.classList.add("is-selected");
        }

        button.addEventListener("click", () => {
          selectedOptions[option.name] = value;

          renderOptions();
          updateSelectedVariant();
        });

        buttonContainer.appendChild(button);
      });

      optionWrapper.appendChild(buttonContainer);
    } else {
      /*
       * Size and other options are displayed
       * as select fields.
       */
      const select = document.createElement("select");

      select.className =
        "gift-product-modal__select";

      select.setAttribute(
        "aria-label",
        option.name,
      );

      option.values.forEach((value) => {
        const optionElement =
          document.createElement("option");

        optionElement.value = value;

        optionElement.textContent = value;

        if (selectedOptions[option.name] === value) {
          optionElement.selected = true;
        }

        select.appendChild(optionElement);
      });

      select.addEventListener("change", () => {
        selectedOptions[option.name] =
          select.value;

        updateSelectedVariant();
      });

      optionWrapper.appendChild(select);
    }

    container.appendChild(optionWrapper);
  }

  /**
   * Render all product options.
   */
  function renderOptions() {
    const container = document.querySelector(
      "[data-modal-options]",
    );

    if (!container || !currentProduct) {
      return;
    }

    container.innerHTML = "";

    const options =
      getProductOptions(currentProduct);

    options.forEach((option) => {
      renderOption(option);
    });
  }

  /**
   * Open product popup.
   *
   * Popup behavior is preserved.
   */
  function openModal(product, trigger) {
    const modal = document.querySelector(
      "[data-product-modal]",
    );

    if (!modal || !product) {
      return;
    }

    currentProduct = product;
    currentTrigger = trigger || null;
    selectedOptions = {};

    /*
     * Start with the first available variant.
     */
    const firstVariant =
      getFirstAvailableVariant(product);

    /*
     * Select the first available variant's
     * options.
     */
    if (firstVariant) {
      const options =
        getProductOptions(product);

      options.forEach((option, index) => {
        if (
          firstVariant.options &&
          firstVariant.options[index] !== undefined
        ) {
          selectedOptions[option.name] =
            firstVariant.options[index];
        }
      });

      selectedVariant = firstVariant;
    } else {
      selectedVariant = null;
    }

    const title =
      modal.querySelector(
        "[data-modal-title]",
      );

    const price =
      modal.querySelector(
        "[data-modal-price]",
      );

    const description =
      modal.querySelector(
        "[data-modal-description]",
      );

    const image =
      modal.querySelector(
        "[data-modal-image]",
      );

    const error =
      modal.querySelector(
        "[data-modal-error]",
      );

    /*
     * Product title.
     */
    if (title) {
      title.textContent =
        product.title || "";
    }

    /*
     * Product price.
     */
    if (price) {
      const section =
        document.querySelector(
          ".custom-product-grid-section",
        );

      const currency =
        section?.dataset.currency ||
        "EUR";

      const priceValue =
        firstVariant?.price ??
        product.price;

      price.textContent =
        formatMoney(
          priceValue,
          currency,
        );
    }

    /*
     * Product description.
     */
    if (description) {
      description.innerHTML =
        product.description || "";
    }

    /*
     * Product image.
     *
     * The image URL comes directly from the
     * product trigger's data-product-image.
     */
    if (image) {
      const productImage =
        trigger?.dataset.productImage;

      if (productImage) {
        image.src = productImage;

        image.alt =
          product.title ||
          trigger?.dataset.productTitle ||
          "";
      } else {
        /*
         * Fallback to product featured image
         * if available in the JSON.
         */
        const fallbackImage =
          product.featured_image?.src ||
          product.featured_image;

        if (fallbackImage) {
          image.src = fallbackImage;

          image.alt =
            product.title || "";
        } else {
          image.removeAttribute("src");

          image.alt = "";
        }
      }
    }

    /*
     * Clear previous error.
     */
    if (error) {
      error.hidden = true;

      error.textContent = "";
    }

    /*
     * Render product options.
     */
    renderOptions();

    /*
     * Make sure the correct variant is selected.
     */
    updateSelectedVariant();

    /*
     * Open popup.
     */
    modal.classList.add("is-open");

    modal.setAttribute(
      "aria-hidden",
      "false",
    );

    document.body.style.overflow =
      "hidden";

    /*
     * Move keyboard focus to close button.
     */
    const closeButton =
      modal.querySelector(
        "[data-modal-close]",
      );

    if (closeButton) {
      closeButton.focus();
    }
  }

  /**
   * Close product popup.
   */
  function closeModal() {
    const modal = document.querySelector(
      "[data-product-modal]",
    );

    if (!modal) {
      return;
    }

    modal.classList.remove("is-open");

    modal.setAttribute(
      "aria-hidden",
      "true",
    );

    document.body.style.overflow = "";

    currentProduct = null;
    currentTrigger = null;
    selectedOptions = {};
    selectedVariant = null;
  }

  /**
   * Find the Black + Medium variant
   * of Soft Winter Jacket.
   */
  async function getSoftWinterJacketVariant() {
    try {
      const response = await fetch(
        `${window.Shopify.routes.root}products/dark-winter-jacket.js`,
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load Soft Winter Jacket.",
        );
      }

      const product =
        await response.json();

      if (
        !product ||
        !Array.isArray(product.variants)
      ) {
        return null;
      }

      /*
       * CSV/product data uses:
       *
       * Size = M
       * Color = Black
       *
       * We check values without depending
       * on option order.
       */
      const variant =
        product.variants.find(
          (item) => {
            if (
              !Array.isArray(
                item.options,
              )
            ) {
              return false;
            }

            const options =
              item.options.map(
                (value) =>
                  String(value)
                    .trim()
                    .toLowerCase(),
              );

            const hasBlack =
              options.includes(
                "black",
              );

            const hasMedium =
              options.includes("m") ||
              options.includes(
                "medium",
              );

            return (
              hasBlack &&
              hasMedium &&
              item.available !== false
            );
          },
        );

      return variant || null;
    } catch (error) {
      console.error(
        "Soft Winter Jacket error:",
        error,
      );

      return null;
    }
  }

  /**
   * Check whether the selected variant
   * has Black + Medium options.
   */
  function requiresSoftWinterJacket() {
    if (
      !selectedVariant ||
      !Array.isArray(
        selectedVariant.options,
      )
    ) {
      return false;
    }

    const options =
      selectedVariant.options.map(
        (value) =>
          String(value)
            .trim()
            .toLowerCase(),
      );

    const hasBlack =
      options.includes("black");

    const hasMedium =
      options.includes("m") ||
      options.includes("medium");

    return (
      hasBlack &&
      hasMedium
    );
  }

  /**
   * Add selected product to Shopify cart.
   */
  async function addToCart() {
    const modal =
      document.querySelector(
        "[data-product-modal]",
      );

    const addButton =
      modal?.querySelector(
        "[data-add-to-cart]",
      );

    const errorElement =
      modal?.querySelector(
        "[data-modal-error]",
      );

    if (!selectedVariant) {
      if (errorElement) {
        errorElement.textContent =
          "Please select an available variant.";

        errorElement.hidden = false;
      }

      return;
    }

    if (addButton) {
      addButton.disabled = true;
    }

    if (errorElement) {
      errorElement.hidden = true;

      errorElement.textContent = "";
    }

    try {
      const items = [
        {
          id: selectedVariant.id,
          quantity: 1,
        },
      ];

      /*
       * Assessment requirement:
       *
       * If ANY selected product has a
       * Black + Medium variant selected,
       * automatically add Soft Winter Jacket.
       */
      if (
        requiresSoftWinterJacket() &&
        currentProduct?.handle !==
          "dark-winter-jacket"
      ) {
        const jacketVariant =
          await getSoftWinterJacketVariant();

        if (jacketVariant) {
          items.push({
            id: jacketVariant.id,
            quantity: 1,
          });
        }
      }

      const response = await fetch(
        `${window.Shopify.routes.root}cart/add.js`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },

          body: JSON.stringify({
            items,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.description ||
            data.message ||
            "Unable to add product to cart.",
        );
      }

      /*
       * Close popup after successful add.
       */
      closeModal();

      /*
       * Let the theme know that the cart
       * was updated.
       */
      document.dispatchEvent(
        new CustomEvent(
          "cart:updated",
          {
            detail: data,
          },
        ),
      );

      /*
       * Simple confirmation.
       */
      alert(
        "Product added to cart.",
      );
    } catch (error) {
      console.error(
        "Add to cart error:",
        error,
      );

      if (errorElement) {
        errorElement.textContent =
          error.message ||
          "Something went wrong. Please try again.";

        errorElement.hidden =
          false;
      }
    } finally {
      if (addButton) {
        addButton.disabled =
          false;
      }
    }
  }

  /**
   * Initialise product grid.
   */
  function initProductGrid() {
    const triggers =
      document.querySelectorAll(
        "[data-product-trigger]",
      );

    triggers.forEach((trigger) => {
      /*
       * Avoid duplicate click listeners.
       */
      if (
        trigger.dataset.initialized ===
        "true"
      ) {
        return;
      }

      trigger.dataset.initialized =
        "true";

      trigger.addEventListener(
        "click",
        () => {
          const product =
            getProductData(
              trigger,
            );

          if (product) {
            openModal(
              product,
              trigger,
            );
          }
        },
      );
    });

    const modal =
      document.querySelector(
        "[data-product-modal]",
      );

    if (!modal) {
      return;
    }

    /*
     * Initialise modal controls only once.
     */
    if (
      modal.dataset.initialized ===
      "true"
    ) {
      return;
    }

    modal.dataset.initialized =
      "true";

    /*
     * Overlay and close button.
     */
    modal
      .querySelectorAll(
        "[data-modal-close]",
      )
      .forEach((element) => {
        element.addEventListener(
          "click",
          closeModal,
        );
      });

    /*
     * Add to Cart.
     */
    const addButton =
      modal.querySelector(
        "[data-add-to-cart]",
      );

    if (addButton) {
      addButton.addEventListener(
        "click",
        addToCart,
      );
    }
  }

  /*
   * Normal page load.
   */
  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initProductGrid,
    );
  } else {
    initProductGrid();
  }

  /*
   * Shopify Theme Editor reloads sections
   * dynamically.
   */
  document.addEventListener(
    "shopify:section:load",
    initProductGrid,
  );

  /*
   * ESC closes the popup.
   */
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    },
  );
})();