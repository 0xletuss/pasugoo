// request-modal.js - Pasugo Request Modal Controller (WITH FILE UPLOAD)
// Handles animations, form steps, and modal transitions
// FIXED: Only initializes once, listens to navbar plus button only

class RequestModalController {
  constructor() {
    this.currentStep = 1;
    this.maxSteps = 3;
    this.initialized = false;

    this.formData = {
      serviceType: null,
      vehicleType: null,
      billPhotos: [],
      attachedFiles: [], // NEW: General file attachments
      pickupItems: [],
      pickupLocation: "",
      deliveryOption: "current-location",
      deliveryAddress: "",
      items: "",
      budget: 0,
      instructions: "",
      location: null,
    };

    this.isWaiting = false;
    this.waitingTimer = 0;
    this.waitingTimerId = null;
    this.requestId = null;

    // Try to initialize
    this.init();
  }

  // Initialize - with safety checks
  init() {
    if (this.initialized) {
      console.warn("⚠️ RequestModalController already initialized - skipping");
      return;
    }

    console.log("🚀 Initializing RequestModalController...");

    if (!this.initElements()) {
      console.error("❌ Failed to initialize - missing elements");
      return;
    }

    this.setupEventListeners();
    this.initialized = true;
    console.log("✅ RequestModalController initialized successfully");
  }

  // Initialize DOM elements - with null checks
  initElements() {
    try {
      // Request Modal
      this.requestModalOverlay = document.getElementById("requestModalOverlay");
      this.requestModal = document.getElementById("requestModal");
      this.closeRequestBtn = document.getElementById("closeRequestBtn");

      if (!this.requestModalOverlay) {
        console.error("❌ requestModalOverlay not found");
        return false;
      }

      // Form steps
      this.formSteps = {
        1: document.getElementById("step1"),
        2: document.getElementById("step2"),
        3: document.getElementById("step3"),
      };

      // Step indicators
      this.stepIndicators = {
        1: document.getElementById("step1Indicator"),
        2: document.getElementById("step2Indicator"),
        3: document.getElementById("step3Indicator"),
      };

      // Form title
      this.formTitle = document.getElementById("formTitle");

      // Service cards
      this.serviceCards = document.querySelectorAll(".service-card");

      // Vehicle cards
      this.vehicleCards = document.querySelectorAll(".vehicle-card");
      this.vehicleSection = document.getElementById("vehicleSection");

      // Bill photo upload
      this.billPhotoSection = document.getElementById("billPhotoSection");
      this.photoUploadArea = document.getElementById("photoUploadArea");
      this.billPhotoInput = document.getElementById("billPhotoInput");
      this.photoPreviewContainer = document.getElementById(
        "photoPreviewContainer",
      );

      // NEW: General file upload section
      this.fileUploadSection = document.getElementById("fileUploadSection");
      this.fileUploadArea = document.getElementById("fileUploadArea");
      this.generalFileInput = document.getElementById("generalFileInput");
      this.filePreviewContainer = document.getElementById(
        "filePreviewContainer",
      );

      // Form inputs
      this.itemsList = document.getElementById("itemsList");
      this.budgetLimit = document.getElementById("budgetLimit");
      this.budgetSection = document.getElementById("budgetSection");
      this.instructions = document.getElementById("instructions");
      this.itemsLabel = document.getElementById("itemsLabel");
      this.itemsHelper = document.getElementById("itemsHelper");

      // Groceries items form
      this.groceriesItemsForm = document.getElementById("groceriesItemsForm");
      this.itemsContainer = document.getElementById("itemsContainer");
      this.addItemBtn = document.getElementById("addItemBtn");

      // Pick & Deliver form
      this.pickDeliverForm = document.getElementById("pickDeliverForm");
      this.pickupItemsContainer = document.getElementById(
        "pickupItemsContainer",
      );
      this.addPickupItemBtn = document.getElementById("addPickupItemBtn");
      this.pickupLocation = document.getElementById("pickupLocation");
      this.currentLocationDisplay = document.getElementById(
        "currentLocationDisplay",
      );
      this.deliveryAddressInput = document.getElementById("deliveryAddress");
      this.deliveryRadioButtons = document.querySelectorAll(
        'input[name="deliveryOption"]',
      );

      // Step 1 buttons
      this.step1Next = document.getElementById("step1Next");

      // Step 2 buttons
      this.step2Title = document.getElementById("step2Title");
      this.step2Back = document.getElementById("step2Back");
      this.step2Next = document.getElementById("step2Next");

      // Step 3 buttons
      this.step3Back = document.getElementById("step3Back");
      this.submitRequest = document.getElementById("submitRequest");

      // Confirmation items
      this.confService = document.getElementById("confService");
      this.confVehicleItem = document.getElementById("confVehicleItem");
      this.confVehicle = document.getElementById("confVehicle");
      this.confItems = document.getElementById("confItems");
      this.confBudget = document.getElementById("confBudget");
      this.confLocation = document.getElementById("confLocation");

      // Waiting Modal (get FIRST occurrence only)
      const waitingOverlays = document.querySelectorAll(
        ".waiting-modal-overlay",
      );
      this.waitingModalOverlay = waitingOverlays[0]; // First one only
      this.waitingModal = document.getElementById("waitingModal");
      this.closeWaitingBtn = document.getElementById("closeWaitingBtn");
      this.cancelRequestBtn = document.getElementById("cancelRequestBtn");
      this.waitingStatus = document.getElementById("waitingStatus");
      this.waitingTime = document.getElementById("waitingTime");

      // Chat Modal (get FIRST occurrence only)
      const chatOverlays = document.querySelectorAll(".chat-modal-overlay");
      this.chatModalOverlay = chatOverlays[0]; // First one only
      this.chatModal = document.getElementById("chatModal");
      this.closeChatBtn = document.getElementById("closeChatBtn");
      this.messageInput = document.getElementById("messageInput");
      this.sendMessageBtn = document.getElementById("sendMessageBtn");
      this.chatContainer = document.getElementById("chatContainer");
      this.riderName = document.getElementById("riderName");
      this.riderStatus = document.getElementById("riderStatus");
      this.riderCallBtn = document.getElementById("riderCallBtn");

      // Backdrop (get FIRST occurrence only)
      const backdrops = document.querySelectorAll(".modal-backdrop");
      this.modalBackdrop = backdrops[0]; // First one only

      return true;
    } catch (error) {
      console.error("❌ Error initializing elements:", error);
      return false;
    }
  }

  // Setup all event listeners
  setupEventListeners() {
    console.log("📌 Setting up event listeners...");

    // Open request modal - ONLY from navbar plus button
    const navFab = document.querySelector(".nav-fab");
    if (navFab) {
      navFab.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("🔘 Navbar plus button clicked");
        this.openRequestModal();
      });
    } else {
      console.warn("⚠️ .nav-fab element not found");
    }

    // Close buttons
    if (this.closeRequestBtn) {
      this.closeRequestBtn.addEventListener("click", () => {
        console.log("❌ Request modal close button clicked");
        this.closeRequestModal();
      });
    }

    if (this.closeWaitingBtn) {
      this.closeWaitingBtn.addEventListener("click", () => {
        console.log("❌ Waiting modal close button clicked");
        this.closeWaitingModal();
      });
    }

    if (this.closeChatBtn) {
      this.closeChatBtn.addEventListener("click", () => {
        console.log("❌ Chat modal close button clicked");
        this.closeChatModal();
      });
    }

    // Backdrop click - only close if not waiting
    if (this.modalBackdrop) {
      this.modalBackdrop.addEventListener("click", () => {
        if (!this.isWaiting) {
          console.log("🎯 Backdrop clicked - closing modal");
          this.closeRequestModal();
        }
      });
    }

    // Service card selection
    this.serviceCards.forEach((card) => {
      card.addEventListener("click", () => {
        this.selectService(card);
      });
    });

    // Vehicle card selection
    this.vehicleCards.forEach((card) => {
      card.addEventListener("click", () => {
        this.selectVehicle(card);
      });
    });

    // Bill photo upload
    if (this.photoUploadArea) {
      this.photoUploadArea.addEventListener("click", () => {
        this.billPhotoInput.click();
      });

      this.photoUploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.photoUploadArea.classList.add("active");
      });

      this.photoUploadArea.addEventListener("dragleave", () => {
        this.photoUploadArea.classList.remove("active");
      });

      this.photoUploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        this.photoUploadArea.classList.remove("active");
        this.handlePhotoUpload(e.dataTransfer.files);
      });
    }

    if (this.billPhotoInput) {
      this.billPhotoInput.addEventListener("change", (e) => {
        this.handlePhotoUpload(e.target.files);
      });
    }

    // NEW: General file upload
    if (this.fileUploadArea) {
      this.fileUploadArea.addEventListener("click", () => {
        this.generalFileInput.click();
      });

      this.fileUploadArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.fileUploadArea.classList.add("active");
      });

      this.fileUploadArea.addEventListener("dragleave", () => {
        this.fileUploadArea.classList.remove("active");
      });

      this.fileUploadArea.addEventListener("drop", (e) => {
        e.preventDefault();
        this.fileUploadArea.classList.remove("active");
        this.handleFileUpload(e.dataTransfer.files);
      });
    }

    if (this.generalFileInput) {
      this.generalFileInput.addEventListener("change", (e) => {
        this.handleFileUpload(e.target.files);
      });
    }

    // Add item button for groceries
    if (this.addItemBtn) {
      this.addItemBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.addItemField();
      });
    }

    // Add pickup item button for pick & deliver
    if (this.addPickupItemBtn) {
      this.addPickupItemBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.addPickupItemField();
      });
    }

    // Delivery option radio buttons
    this.deliveryRadioButtons.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.formData.deliveryOption = e.target.value;
        console.log(`📦 Delivery option: ${this.formData.deliveryOption}`);

        if (e.target.value === "custom-address") {
          this.deliveryAddressInput.style.display = "block";
          this.deliveryAddressInput.focus();
        } else {
          this.deliveryAddressInput.style.display = "none";
          this.deliveryAddressInput.value = "";
          this.formData.deliveryAddress = "";
        }
      });
    });

    // Navigation buttons
    if (this.step1Next) {
      this.step1Next.addEventListener("click", () => this.nextStep());
    }
    if (this.step2Back) {
      this.step2Back.addEventListener("click", () => this.prevStep());
    }
    if (this.step2Next) {
      this.step2Next.addEventListener("click", () => this.nextStep());
    }
    if (this.step3Back) {
      this.step3Back.addEventListener("click", () => this.prevStep());
    }
    if (this.submitRequest) {
      this.submitRequest.addEventListener("click", () =>
        this.submitNewRequest(),
      );
    }

    // Cancel request
    if (this.cancelRequestBtn) {
      this.cancelRequestBtn.addEventListener("click", () =>
        this.cancelRequest(),
      );
    }

    // Chat messages
    if (this.sendMessageBtn) {
      this.sendMessageBtn.addEventListener("click", () => this.sendMessage());
    }

    if (this.messageInput) {
      this.messageInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    // Rider call button
    if (this.riderCallBtn) {
      this.riderCallBtn.addEventListener("click", () => this.callRider());
    }

    console.log("✅ Event listeners attached");
  }

  // ===== MODAL OPEN/CLOSE =====

  openRequestModal() {
    console.log("📋 Opening request modal");

    if (!this.requestModalOverlay) {
      console.error("❌ Modal overlay not found");
      return;
    }

    this.requestModalOverlay.style.display = "flex";

    if (this.modalBackdrop) {
      this.modalBackdrop.classList.add("active");
    }

    this.resetForm();

    // Trigger animation
    setTimeout(() => {
      if (this.requestModalOverlay) {
        this.requestModalOverlay.style.animation = "slideInUp 0.4s ease";
      }
    }, 10);
  }

  closeRequestModal() {
    console.log("✖️ Closing request modal");

    if (!this.requestModalOverlay) return;

    this.requestModalOverlay.classList.add("closing");

    setTimeout(() => {
      this.requestModalOverlay.style.display = "none";
      this.requestModalOverlay.classList.remove("closing");

      if (this.modalBackdrop) {
        this.modalBackdrop.classList.remove("active");
      }
    }, 300);
  }

  openWaitingModal() {
    console.log("⏳ Opening waiting modal");

    if (!this.waitingModalOverlay) {
      console.error("❌ Waiting modal overlay not found");
      return;
    }

    this.requestModalOverlay.style.display = "none";
    this.waitingModalOverlay.style.display = "flex";

    if (this.modalBackdrop) {
      this.modalBackdrop.classList.add("active");
    }

    this.isWaiting = true;
    this.startWaitingTimer();
  }

  closeWaitingModal() {
    console.log("✖️ Closing waiting modal");

    if (this.waitingModalOverlay) {
      this.waitingModalOverlay.style.display = "none";
    }

    if (this.modalBackdrop) {
      this.modalBackdrop.classList.remove("active");
    }

    this.isWaiting = false;
    this.stopWaitingTimer();
  }

  openChatModal() {
    console.log("💬 Opening chat modal");

    if (!this.chatModalOverlay) {
      console.error("❌ Chat modal overlay not found");
      return;
    }

    this.waitingModalOverlay.style.display = "none";
    this.chatModalOverlay.style.display = "flex";

    if (this.modalBackdrop) {
      this.modalBackdrop.classList.add("active");
    }
  }

  closeChatModal() {
    console.log("✖️ Closing chat modal");

    if (this.chatModalOverlay) {
      this.chatModalOverlay.style.display = "none";
    }

    if (this.modalBackdrop) {
      this.modalBackdrop.classList.remove("active");
    }
  }

  // ===== FORM STEP NAVIGATION =====

  nextStep() {
    if (!this.validateStep(this.currentStep)) {
      return;
    }

    if (this.currentStep < this.maxSteps) {
      this.goToStep(this.currentStep + 1);
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.goToStep(this.currentStep - 1);
    }
  }

  goToStep(stepNumber) {
    console.log(`📄 Going to step ${stepNumber}`);

    // Hide current step
    this.formSteps[this.currentStep].classList.remove("active");

    // Update step indicator
    this.stepIndicators[this.currentStep].classList.remove("active");
    if (stepNumber > this.currentStep) {
      this.stepIndicators[this.currentStep].classList.add("completed");
    }

    // Show new step
    this.currentStep = stepNumber;
    this.formSteps[stepNumber].classList.add("active");
    this.stepIndicators[stepNumber].classList.add("active");

    // Update title
    const titles = ["", "Select Service", "Add Details", "Confirm Request"];
    this.formTitle.textContent = titles[stepNumber];

    // Scroll to top
    if (this.requestModal) {
      this.requestModal.scrollTop = 0;
    }
  }

  // ===== FORM VALIDATION =====

  validateStep(step) {
    switch (step) {
      case 1:
        if (!this.formData.serviceType) {
          alert("Please select a service type");
          return false;
        }
        return true;

      case 2:
        // Check if vehicle is required (for pickup service)
        if (
          this.formData.serviceType === "pickup" &&
          !this.formData.vehicleType
        ) {
          alert("Please select a vehicle type");
          return false;
        }

        // Check if bill photos uploaded (for bills service)
        if (
          this.formData.serviceType === "bills" &&
          this.formData.billPhotos.length === 0
        ) {
          alert("Please upload at least one bill photo");
          return false;
        }

        // Check Pick & Deliver validation
        if (this.formData.serviceType === "delivery") {
          // Get pickup items
          const pickupItems = this.getPickupItems();
          if (!pickupItems.trim()) {
            alert("Please add at least one item to pick up");
            return false;
          }

          // Check pickup location
          if (!this.pickupLocation.value.trim()) {
            alert("Please enter the pickup location");
            return false;
          }

          // Check delivery address if custom
          if (this.formData.deliveryOption === "custom-address") {
            if (!this.deliveryAddressInput.value.trim()) {
              alert("Please enter the delivery address");
              return false;
            }
            this.formData.deliveryAddress =
              this.deliveryAddressInput.value.trim();
          }

          // Save data
          this.formData.pickupItems = pickupItems;
          this.formData.pickupLocation = this.pickupLocation.value.trim();
          this.formData.items = `Pick from: ${this.formData.pickupLocation} | Items: ${pickupItems}`;
          this.formData.budget = 0;
          this.formData.instructions = this.instructions.value.trim();
          return true;
        }

        // Get items based on service type
        let itemsText = "";
        if (this.formData.serviceType === "groceries") {
          itemsText = this.getGroceriesItems();
          if (!itemsText.trim()) {
            alert("Please add at least one grocery item");
            return false;
          }
        } else {
          itemsText = this.itemsList.value.trim();
          if (!itemsText) {
            alert("Please add at least one item");
            return false;
          }
        }

        this.formData.items = itemsText;
        this.formData.budget = parseFloat(this.budgetLimit.value) || 0;
        this.formData.instructions = this.instructions.value.trim();
        return true;

      case 3:
        return true;

      default:
        return true;
    }
  }

  // ===== SERVICE SELECTION =====

  selectService(card) {
    // Remove previous selection
    this.serviceCards.forEach((c) => c.classList.remove("selected"));

    // Add selection to clicked card
    card.classList.add("selected");

    // Store service type
    this.formData.serviceType = card.dataset.service;
    console.log(`✅ Selected service: ${this.formData.serviceType}`);

    // Enable next button
    this.step1Next.disabled = false;

    // Update step 2 title based on service
    const titles = {
      groceries: "What groceries do you need?",
      bills: "Which bills do you need to pay?",
      delivery: "What needs to be picked up & delivered?",
      pharmacy: "What items do you need from pharmacy?",
      pickup: "Where would you like to go?",
      documents: "Which documents do you need to process?",
    };

    // Update labels and placeholders based on service
    const labels = {
      groceries: {
        label: "Items List",
        placeholder: "E.g., 2kg rice, 1L milk, 5 eggs, tomatoes...",
        helper: "List all items you need",
      },
      bills: {
        label: "Bills to Pay",
        placeholder: "E.g., Electricity, Water, Internet bills...",
        helper: "List which bills need to be paid",
      },
      delivery: {
        label: "Items to Deliver",
        placeholder: "E.g., Documents, Package, Files...",
        helper: "What needs to be picked up and delivered?",
      },
      pharmacy: {
        label: "Pharmacy Items",
        placeholder: "E.g., Paracetamol, Cough syrup...",
        helper: "List the pharmacy items you need",
      },
      pickup: {
        label: "Destination",
        placeholder: "E.g., SM Mall, Airport, Home address...",
        helper: "Where would you like the rider to pick you up and go?",
      },
      documents: {
        label: "Documents Needed",
        placeholder: "E.g., Birth certificate, ID renewal...",
        helper: "What documents need to be processed?",
      },
    };

    const labelConfig = labels[this.formData.serviceType];
    if (labelConfig) {
      this.itemsLabel.textContent = labelConfig.label;
      this.itemsList.placeholder = labelConfig.placeholder;
      this.itemsHelper.textContent = labelConfig.helper;
    }

    this.step2Title.textContent = titles[this.formData.serviceType];

    // Show/hide vehicle section based on service type
    if (this.formData.serviceType === "pickup") {
      this.vehicleSection.style.display = "block";
      // Reset vehicle selection when switching services
      this.vehicleCards.forEach((card) => card.classList.remove("selected"));
      this.formData.vehicleType = null;
    } else {
      this.vehicleSection.style.display = "none";
      this.vehicleCards.forEach((card) => card.classList.remove("selected"));
      this.formData.vehicleType = null;
    }

    // Show/hide bill photo section based on service type
    if (this.formData.serviceType === "bills") {
      this.billPhotoSection.style.display = "block";
      this.fileUploadSection.style.display = "none"; // Hide general file upload for bills
    } else {
      this.billPhotoSection.style.display = "none";
      this.formData.billPhotos = [];
      this.photoPreviewContainer.innerHTML = "";
      this.billPhotoInput.value = "";

      // Show general file upload for all other services
      this.fileUploadSection.style.display = "block";
    }

    // Show/hide budget section (only for groceries)
    if (this.formData.serviceType === "groceries") {
      this.budgetSection.style.display = "block";
      this.groceriesItemsForm.style.display = "block";
      this.itemsList.style.display = "none";
      this.itemsHelper.style.display = "none";
      this.pickDeliverForm.style.display = "none";

      // Initialize with one empty item field if none exist
      if (this.itemsContainer.children.length === 0) {
        this.addItemField();
      }
    } else if (this.formData.serviceType === "delivery") {
      // Pick & Deliver
      this.budgetSection.style.display = "none";
      this.budgetLimit.value = "";
      this.groceriesItemsForm.style.display = "none";
      this.pickDeliverForm.style.display = "block";
      this.itemsList.style.display = "none";
      this.itemsHelper.style.display = "none";

      // Update current location display
      const locationEl = document.getElementById("locationName");
      if (locationEl) {
        this.currentLocationDisplay.textContent = locationEl.textContent;
      }

      // Initialize with one pickup item if none exist
      if (this.pickupItemsContainer.children.length === 0) {
        this.addPickupItemField();
      }

      // Reset delivery option
      this.formData.deliveryOption = "current-location";
      document.querySelector(
        'input[name="deliveryOption"][value="current-location"]',
      ).checked = true;
      this.deliveryAddressInput.style.display = "none";
      this.deliveryAddressInput.value = "";
    } else {
      this.budgetSection.style.display = "none";
      this.budgetLimit.value = "";
      this.groceriesItemsForm.style.display = "none";
      this.pickDeliverForm.style.display = "none";
      this.itemsList.style.display = "block";
      this.itemsHelper.style.display = "block";
      this.itemsContainer.innerHTML = "";
      this.pickupItemsContainer.innerHTML = "";
    }

    // Visual feedback
    const title = document.querySelector("#step1 h3");
    if (title) {
      title.style.color = "#28a745";
      setTimeout(() => {
        title.style.color = "#333";
      }, 300);
    }
  }

  // ===== GROCERIES ITEM FORM =====

  addItemField() {
    const itemNumber = this.itemsContainer.children.length + 1;

    const itemGroup = document.createElement("div");
    itemGroup.className = "item-input-group";
    itemGroup.innerHTML = `
      <label style="min-width: 60px; font-size: 13px; font-weight: 600; color: #333;">
        Item ${itemNumber}
      </label>
      <input 
        type="text" 
        placeholder="E.g., 2kg rice, 1L milk, 5 eggs..."
        class="grocery-item-input"
      />
      ${
        itemNumber > 1
          ? `
        <button type="button" class="item-remove-btn">
          <i class="fa-solid fa-trash"></i>
        </button>
      `
          : ""
      }
    `;

    // Add remove event listener if button exists
    const removeBtn = itemGroup.querySelector(".item-remove-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.removeItemField(itemGroup);
      });
    }

    this.itemsContainer.appendChild(itemGroup);

    // Focus on new input
    itemGroup.querySelector("input").focus();

    console.log(`➕ Item field ${itemNumber} added`);
  }

  removeItemField(itemGroup) {
    itemGroup.style.animation = "slideOutDown 0.3s ease";

    setTimeout(() => {
      itemGroup.remove();
      this.updateItemLabels();
      console.log("🗑️ Item field removed");
    }, 300);
  }

  updateItemLabels() {
    const itemInputs =
      this.itemsContainer.querySelectorAll(".item-input-group");
    itemInputs.forEach((group, index) => {
      const label = group.querySelector("label");
      if (label) {
        label.textContent = `Item ${index + 1}`;
      }
    });
  }

  getGroceriesItems() {
    const itemInputs = this.itemsContainer.querySelectorAll(
      ".grocery-item-input",
    );
    const items = [];
    itemInputs.forEach((input) => {
      if (input.value.trim()) {
        items.push(input.value.trim());
      }
    });
    return items.join(", ");
  }

  // ===== PICKUP ITEM FORM (for Pick & Deliver) =====

  addPickupItemField() {
    const itemNumber = this.pickupItemsContainer.children.length + 1;

    const itemGroup = document.createElement("div");
    itemGroup.className = "item-input-group";
    itemGroup.innerHTML = `
      <label style="min-width: 60px; font-size: 13px; font-weight: 600; color: #333;">
        Item ${itemNumber}
      </label>
      <input 
        type="text" 
        placeholder="E.g., Box of documents, Laptop bag..."
        class="pickup-item-input"
      />
      ${
        itemNumber > 1
          ? `
        <button type="button" class="item-remove-btn">
          <i class="fa-solid fa-trash"></i>
        </button>
      `
          : ""
      }
    `;

    // Add remove event listener if button exists
    const removeBtn = itemGroup.querySelector(".item-remove-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.removePickupItemField(itemGroup);
      });
    }

    this.pickupItemsContainer.appendChild(itemGroup);

    // Focus on new input
    itemGroup.querySelector("input").focus();

    console.log(`➕ Pickup item field ${itemNumber} added`);
  }

  removePickupItemField(itemGroup) {
    itemGroup.style.animation = "slideOutDown 0.3s ease";

    setTimeout(() => {
      itemGroup.remove();
      this.updatePickupItemLabels();
      console.log("🗑️ Pickup item field removed");
    }, 300);
  }

  updatePickupItemLabels() {
    const itemInputs =
      this.pickupItemsContainer.querySelectorAll(".item-input-group");
    itemInputs.forEach((group, index) => {
      const label = group.querySelector("label");
      if (label) {
        label.textContent = `Item ${index + 1}`;
      }
    });
  }

  getPickupItems() {
    const itemInputs =
      this.pickupItemsContainer.querySelectorAll(".pickup-item-input");
    const items = [];
    itemInputs.forEach((input) => {
      if (input.value.trim()) {
        items.push(input.value.trim());
      }
    });
    return items.join(", ");
  }

  selectVehicle(card) {
    // Remove previous selection
    this.vehicleCards.forEach((c) => c.classList.remove("selected"));

    // Add selection to clicked card
    card.classList.add("selected");

    // Store vehicle type
    this.formData.vehicleType = card.dataset.vehicle;
    console.log(`🚗 Selected vehicle: ${this.formData.vehicleType}`);
  }

  // ===== PHOTO UPLOAD =====

  handlePhotoUpload(files) {
    const maxFiles = 5;
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please upload image files only");
        return;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        alert("File size must be less than 10MB");
        return;
      }

      // Check max files
      if (this.formData.billPhotos.length >= maxFiles) {
        alert(`Maximum ${maxFiles} photos allowed`);
        return;
      }

      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoData = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: e.target.result,
        };

        this.formData.billPhotos.push(photoData);
        console.log(
          `📸 Photo uploaded: ${file.name} (${this.formData.billPhotos.length}/${maxFiles})`,
        );
        this.displayPhotoPreview(
          photoData,
          this.formData.billPhotos.length - 1,
        );
      };

      reader.readAsDataURL(file);
    });
  }

  displayPhotoPreview(photoData, index) {
    const previewItem = document.createElement("div");
    previewItem.className = "photo-preview-item";
    previewItem.innerHTML = `
      <img src="${photoData.data}" alt="Bill photo ${index + 1}">
      <button type="button" class="photo-remove-btn" data-index="${index}">
        <i class="fa-solid fa-x"></i>
      </button>
    `;

    previewItem
      .querySelector(".photo-remove-btn")
      .addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removePhoto(index);
      });

    this.photoPreviewContainer.appendChild(previewItem);
  }

  removePhoto(index) {
    console.log(`🗑️ Removing photo at index ${index}`);
    this.formData.billPhotos.splice(index, 1);

    // Rebuild preview
    this.photoPreviewContainer.innerHTML = "";
    this.formData.billPhotos.forEach((photo, i) => {
      this.displayPhotoPreview(photo, i);
    });

    // Reset file input
    this.billPhotoInput.value = "";
  }

  // ===== NEW: GENERAL FILE UPLOAD =====

  handleFileUpload(files) {
    const maxFiles = 10;
    const maxFileSize = 25 * 1024 * 1024; // 25MB per file

    Array.from(files).forEach((file) => {
      // Validate file size
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" is too large. Maximum size is 25MB`);
        return;
      }

      // Check max files
      if (this.formData.attachedFiles.length >= maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        return;
      }

      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = {
          name: file.name,
          size: file.size,
          type: file.type,
          data: e.target.result,
        };

        this.formData.attachedFiles.push(fileData);
        console.log(
          `📎 File uploaded: ${file.name} (${this.formData.attachedFiles.length}/${maxFiles})`,
        );
        this.displayFilePreview(
          fileData,
          this.formData.attachedFiles.length - 1,
        );
      };

      reader.readAsDataURL(file);
    });
  }

  displayFilePreview(fileData, index) {
    const previewItem = document.createElement("div");
    previewItem.className = "file-preview-item";

    // Get file icon based on type
    const fileIcon = this.getFileIcon(fileData.type);
    const fileSizeFormatted = this.formatFileSize(fileData.size);

    previewItem.innerHTML = `
      <div class="file-preview-icon">
        <i class="${fileIcon}"></i>
      </div>
      <div class="file-preview-info">
        <div class="file-preview-name">${fileData.name}</div>
        <div class="file-preview-size">${fileSizeFormatted}</div>
      </div>
      <button type="button" class="file-remove-btn" data-index="${index}">
        <i class="fa-solid fa-x"></i>
      </button>
    `;

    previewItem
      .querySelector(".file-remove-btn")
      .addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.removeFile(index);
      });

    this.filePreviewContainer.appendChild(previewItem);
  }

  removeFile(index) {
    console.log(`🗑️ Removing file at index ${index}`);
    this.formData.attachedFiles.splice(index, 1);

    // Rebuild preview
    this.filePreviewContainer.innerHTML = "";
    this.formData.attachedFiles.forEach((file, i) => {
      this.displayFilePreview(file, i);
    });

    // Reset file input
    this.generalFileInput.value = "";
  }

  getFileIcon(mimeType) {
    if (mimeType.startsWith("image/")) return "fa-solid fa-file-image";
    if (mimeType.startsWith("video/")) return "fa-solid fa-file-video";
    if (mimeType.startsWith("audio/")) return "fa-solid fa-file-audio";
    if (mimeType.includes("pdf")) return "fa-solid fa-file-pdf";
    if (mimeType.includes("word") || mimeType.includes("document"))
      return "fa-solid fa-file-word";
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
      return "fa-solid fa-file-excel";
    if (mimeType.includes("powerpoint") || mimeType.includes("presentation"))
      return "fa-solid fa-file-powerpoint";
    if (mimeType.includes("zip") || mimeType.includes("compressed"))
      return "fa-solid fa-file-zipper";
    return "fa-solid fa-file";
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }

  // ===== FORM SUBMISSION =====

  async submitNewRequest() {
    console.log("🚀 Submitting request:", this.formData);

    // Update confirmation display
    this.updateConfirmationDisplay();

    // Validate all data
    if (!this.formData.serviceType || !this.formData.items) {
      alert("Please fill in all required fields");
      return;
    }

    // Add loading state
    this.submitRequest.disabled = true;
    this.submitRequest.innerHTML =
      '<i class="fa-solid fa-spinner"></i> Submitting...';

    try {
      // Prepare request payload
      const token = localStorage.getItem("access_token");
      const userData = JSON.parse(localStorage.getItem("user_data"));

      if (!token || !userData) {
        alert("Please login first");
        return;
      }

      const requestPayload = {
        customer_id: userData.id,
        service_type: this.formData.serviceType,
        items_description: this.formData.items,
        budget_limit: this.formData.budget,
        special_instructions: this.formData.instructions,
        status: "pending",
        created_at: new Date().toISOString(),
        // Include file info (you can send base64 or upload to server first)
        attached_files: this.formData.attachedFiles.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          // data: f.data // Include if sending directly, or upload separately
        })),
        bill_photos: this.formData.billPhotos.map((p) => ({
          name: p.name,
          type: p.type,
          size: p.size,
          // data: p.data
        })),
      };

      // Send to backend
      const response = await fetch(
        "https://pasugo.onrender.com/api/requests/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestPayload),
        },
      );

      if (response.ok) {
        const data = await response.json();
        this.requestId = data.request_id;
        console.log("✅ Request created:", this.requestId);

        // Close form modal and show waiting
        this.requestModalOverlay.style.display = "none";
        this.openWaitingModal();

        // Simulate rider acceptance
        setTimeout(() => {
          this.simulateRiderAcceptance();
        }, 5000);
      } else {
        const error = await response.json();
        alert("Error creating request: " + error.message);
      }
    } catch (error) {
      console.error("❌ Submit error:", error);
      alert("Failed to create request: " + error.message);
    } finally {
      this.submitRequest.disabled = false;
      this.submitRequest.innerHTML = "Find a Rider";
    }
  }

  updateConfirmationDisplay() {
    const serviceNames = {
      groceries: "Buy Groceries",
      bills: "Pay Bills",
      delivery: "Pick & Deliver",
      pharmacy: "Pharmacy",
      pickup: "Pick Me Up",
      documents: "Documents",
    };

    const vehicleNames = {
      motorcycle: "Motorcycle",
      car: "Car",
      van: "Van",
    };

    this.confService.textContent =
      serviceNames[this.formData.serviceType] || "-";

    // Show/hide vehicle info
    if (this.formData.serviceType === "pickup") {
      this.confVehicleItem.style.display = "flex";
      this.confVehicle.textContent =
        vehicleNames[this.formData.vehicleType] || "-";
    } else {
      this.confVehicleItem.style.display = "none";
    }

    // Update items display based on service
    let itemsText = "";
    if (this.formData.serviceType === "delivery") {
      itemsText = `From: ${this.formData.pickupLocation} → ${
        this.formData.deliveryOption === "current-location"
          ? "Your Location"
          : this.formData.deliveryAddress
      }`;
    } else if (this.formData.serviceType === "bills") {
      itemsText = `[${this.formData.billPhotos.length} photo(s)]`;
      if (this.formData.attachedFiles.length > 0) {
        itemsText += ` + ${this.formData.attachedFiles.length} file(s)`;
      }
    } else {
      itemsText =
        this.formData.items.substring(0, 50) +
        (this.formData.items.length > 50 ? "..." : "");
      if (this.formData.attachedFiles.length > 0) {
        itemsText += ` [${this.formData.attachedFiles.length} file(s)]`;
      }
    }

    this.confItems.textContent = itemsText;
    this.confBudget.textContent = this.formData.budget
      ? `₱${this.formData.budget.toFixed(2)}`
      : "No limit";

    // Get current location from map
    const locationEl = document.getElementById("locationName");
    if (locationEl) {
      this.confLocation.textContent = locationEl.textContent;
    }
  }

  // ===== WAITING MODAL =====

  startWaitingTimer() {
    this.waitingTimer = 0;
    this.waitingTimerId = setInterval(() => {
      this.waitingTimer++;
      const minutes = Math.floor(this.waitingTimer / 60);
      const seconds = this.waitingTimer % 60;
      this.waitingTime.textContent = `${minutes}:${seconds
        .toString()
        .padStart(2, "0")}`;

      // Cancel auto after 5 minutes
      if (this.waitingTimer >= 300) {
        this.stopWaitingTimer();
        this.cancelRequest();
      }
    }, 1000);
  }

  stopWaitingTimer() {
    if (this.waitingTimerId) {
      clearInterval(this.waitingTimerId);
      this.waitingTimerId = null;
    }
  }

  async cancelRequest() {
    console.log("❌ Cancelling request");

    if (confirm("Are you sure you want to cancel this request?")) {
      try {
        const token = localStorage.getItem("access_token");

        await fetch(
          `https://pasugo.onrender.com/api/requests/${this.requestId}/cancel`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        this.closeWaitingModal();
        this.resetForm();
        alert("Request cancelled");
      } catch (error) {
        console.error("Cancel error:", error);
      }
    }
  }

  // Simulate rider acceptance
  simulateRiderAcceptance() {
    if (this.isWaiting) {
      console.log("🎉 Rider accepted request!");
      this.stopWaitingTimer();

      // Simulate rider data
      const riderData = {
        id: 1,
        name: "Juan Dela Cruz",
        vehicle: "Honda Motorcycle",
        rating: 4.8,
      };

      this.showChatWithRider(riderData);
    }
  }

  // ===== CHAT MODAL =====

  showChatWithRider(rider) {
    this.riderName.textContent = rider.name;
    this.riderStatus.textContent = "On the way";

    const chatRiderName = document.getElementById("chatRiderName");
    if (chatRiderName) {
      chatRiderName.textContent = rider.name;
    }

    this.openChatModal();

    // Clear previous messages
    this.chatContainer.innerHTML = `
      <div class="message-group system">
        <div class="message-bubble system">
          <strong>${rider.name}</strong> accepted your request
        </div>
      </div>
    `;

    // Add welcome message
    setTimeout(() => {
      this.addRiderMessage(
        `Hi! I'll help you with ${this.formData.serviceType}. Let me get started right away! 👍`,
      );
    }, 500);
  }

  addCustomerMessage(text) {
    const messageGroup = document.createElement("div");
    messageGroup.className = "message-group customer";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble customer";
    bubble.textContent = text;

    messageGroup.appendChild(bubble);
    this.chatContainer.appendChild(messageGroup);

    // Auto-scroll
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  addRiderMessage(text) {
    const messageGroup = document.createElement("div");
    messageGroup.className = "message-group rider";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble rider";
    bubble.textContent = text;

    messageGroup.appendChild(bubble);
    this.chatContainer.appendChild(messageGroup);

    // Auto-scroll
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  sendMessage() {
    const message = this.messageInput.value.trim();

    if (!message) return;

    // Add customer message
    this.addCustomerMessage(message);
    this.messageInput.value = "";

    // Simulate rider response
    setTimeout(() => {
      const responses = [
        "Got it! 👍",
        "On it, will update you soon!",
        "Thanks for clarifying!",
        "I'm at the store now",
        "Heading to your location",
      ];
      const randomResponse =
        responses[Math.floor(Math.random() * responses.length)];
      this.addRiderMessage(randomResponse);
    }, 1500);
  }

  callRider() {
    console.log("📞 Calling rider...");
    alert("Calling rider feature - integrate with Twilio or similar");
  }

  // ===== UTILITY FUNCTIONS =====

  resetForm() {
    this.currentStep = 1;
    this.formData = {
      serviceType: null,
      vehicleType: null,
      billPhotos: [],
      attachedFiles: [], // Reset attached files
      items: "",
      budget: 0,
      instructions: "",
      location: null,
    };

    // Reset UI
    this.serviceCards.forEach((card) => card.classList.remove("selected"));
    this.vehicleCards.forEach((card) => card.classList.remove("selected"));
    this.vehicleSection.style.display = "none";
    this.billPhotoSection.style.display = "none";
    this.fileUploadSection.style.display = "none";
    this.budgetSection.style.display = "none";
    this.groceriesItemsForm.style.display = "none";
    this.pickDeliverForm.style.display = "none";
    this.itemsList.style.display = "block";
    this.itemsHelper.style.display = "block";
    this.photoPreviewContainer.innerHTML = "";
    this.filePreviewContainer.innerHTML = "";
    this.itemsContainer.innerHTML = "";
    this.pickupItemsContainer.innerHTML = "";
    this.billPhotoInput.value = "";
    this.generalFileInput.value = "";
    this.itemsList.value = "";
    this.budgetLimit.value = "";
    this.pickupLocation.value = "";
    this.deliveryAddressInput.value = "";
    this.instructions.value = "";
    this.step1Next.disabled = true;

    // Reset steps
    Object.keys(this.formSteps).forEach((step) => {
      this.formSteps[step].classList.remove("active");
      this.stepIndicators[step].classList.remove("active", "completed");
    });

    this.formSteps[1].classList.add("active");
    this.stepIndicators[1].classList.add("active");
    this.formTitle.textContent = "New Request";

    console.log("🔄 Form reset");
  }
}

// Export for use in other modules if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = RequestModalController;
}

// Initialize ONLY ONCE when DOM is ready
let requestModalInstance = null;

document.addEventListener("DOMContentLoaded", () => {
  if (!requestModalInstance) {
    console.log("🎯 DOM ready - initializing Request Modal");
    requestModalInstance = new RequestModalController();
  } else {
    console.warn("⚠️ RequestModalController instance already exists");
  }
});

// Safety: Prevent multiple initializations
window.addEventListener("load", () => {
  if (!requestModalInstance) {
    console.log("📌 Window load - initializing Request Modal");
    requestModalInstance = new RequestModalController();
  }
});
