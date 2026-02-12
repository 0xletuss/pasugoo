// request-modal.js - COMPLETE VERSION WITH REAL RIDER MATCHING
// Uses api_request.js for all backend API calls

class RequestModalController {
  constructor() {
    this.currentStep = 1;
    this.maxSteps = 3;
    this.initialized = false;

    this.formData = {
      serviceType: null,
      vehicleType: null,
      billPhotos: [],
      attachedFiles: [],
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
    this.statusPollInterval = null;
    this.requestId = null;

    // Check if API is available
    if (typeof pasugoAPI === "undefined") {
      console.error(
        "❌ pasugoAPI not found! Make sure api_request.js is loaded BEFORE request-modal.js",
      );
    }

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

      // General file upload section
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

      // Waiting Modal
      const waitingOverlays = document.querySelectorAll(
        ".waiting-modal-overlay",
      );
      this.waitingModalOverlay = waitingOverlays[0];
      this.waitingModal = document.getElementById("waitingModal");
      this.closeWaitingBtn = document.getElementById("closeWaitingBtn");
      this.cancelRequestBtn = document.getElementById("cancelRequestBtn");
      this.waitingStatus = document.getElementById("waitingStatus");
      this.waitingTime = document.getElementById("waitingTime");

      // Chat Modal
      const chatOverlays = document.querySelectorAll(".chat-modal-overlay");
      this.chatModalOverlay = chatOverlays[0];
      this.chatModal = document.getElementById("chatModal");
      this.closeChatBtn = document.getElementById("closeChatBtn");
      this.messageInput = document.getElementById("messageInput");
      this.sendMessageBtn = document.getElementById("sendMessageBtn");
      this.chatContainer = document.getElementById("chatContainer");
      this.riderName = document.getElementById("riderName");
      this.riderStatus = document.getElementById("riderStatus");
      this.riderCallBtn = document.getElementById("riderCallBtn");

      // Backdrop
      const backdrops = document.querySelectorAll(".modal-backdrop");
      this.modalBackdrop = backdrops[0];

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
    }

    // Close buttons
    if (this.closeRequestBtn) {
      this.closeRequestBtn.addEventListener("click", () => {
        this.closeRequestModal();
      });
    }

    if (this.closeWaitingBtn) {
      this.closeWaitingBtn.addEventListener("click", () => {
        this.closeWaitingModal();
      });
    }

    if (this.closeChatBtn) {
      this.closeChatBtn.addEventListener("click", () => {
        this.closeChatModal();
      });
    }

    // Backdrop click
    if (this.modalBackdrop) {
      this.modalBackdrop.addEventListener("click", () => {
        if (!this.isWaiting) {
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

    // General file upload
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

    // Add pickup item button
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

    this.formSteps[this.currentStep].classList.remove("active");
    this.stepIndicators[this.currentStep].classList.remove("active");
    if (stepNumber > this.currentStep) {
      this.stepIndicators[this.currentStep].classList.add("completed");
    }

    this.currentStep = stepNumber;
    this.formSteps[stepNumber].classList.add("active");
    this.stepIndicators[stepNumber].classList.add("active");

    const titles = ["", "Select Service", "Add Details", "Confirm Request"];
    this.formTitle.textContent = titles[stepNumber];

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
        if (
          this.formData.serviceType === "pickup" &&
          !this.formData.vehicleType
        ) {
          alert("Please select a vehicle type");
          return false;
        }

        if (
          this.formData.serviceType === "bills" &&
          this.formData.billPhotos.length === 0
        ) {
          alert("Please upload at least one bill photo");
          return false;
        }

        if (this.formData.serviceType === "delivery") {
          const pickupItems = this.getPickupItems();
          if (!pickupItems.trim()) {
            alert("Please add at least one item to pick up");
            return false;
          }

          if (!this.pickupLocation.value.trim()) {
            alert("Please enter the pickup location");
            return false;
          }

          if (this.formData.deliveryOption === "custom-address") {
            if (!this.deliveryAddressInput.value.trim()) {
              alert("Please enter the delivery address");
              return false;
            }
            this.formData.deliveryAddress =
              this.deliveryAddressInput.value.trim();
          }

          this.formData.pickupItems = pickupItems;
          this.formData.pickupLocation = this.pickupLocation.value.trim();
          this.formData.items = `Pick from: ${this.formData.pickupLocation} | Items: ${pickupItems}`;
          this.formData.budget = 0;
          this.formData.instructions = this.instructions.value.trim();
          return true;
        }

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
    this.serviceCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");

    this.formData.serviceType = card.dataset.service;
    console.log(`✅ Selected service: ${this.formData.serviceType}`);

    this.step1Next.disabled = false;

    const titles = {
      groceries: "What groceries do you need?",
      bills: "Which bills do you need to pay?",
      delivery: "What needs to be picked up & delivered?",
      pharmacy: "What items do you need from pharmacy?",
      pickup: "Where would you like to go?",
      documents: "Which documents do you need to process?",
    };

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

    if (this.formData.serviceType === "pickup") {
      this.vehicleSection.style.display = "block";
      this.vehicleCards.forEach((card) => card.classList.remove("selected"));
      this.formData.vehicleType = null;
    } else {
      this.vehicleSection.style.display = "none";
      this.vehicleCards.forEach((card) => card.classList.remove("selected"));
      this.formData.vehicleType = null;
    }

    if (this.formData.serviceType === "bills") {
      this.billPhotoSection.style.display = "block";
      this.fileUploadSection.style.display = "none";
    } else {
      this.billPhotoSection.style.display = "none";
      this.formData.billPhotos = [];
      this.photoPreviewContainer.innerHTML = "";
      this.billPhotoInput.value = "";
      this.fileUploadSection.style.display = "block";
    }

    if (this.formData.serviceType === "groceries") {
      this.budgetSection.style.display = "block";
      this.groceriesItemsForm.style.display = "block";
      this.itemsList.style.display = "none";
      this.itemsHelper.style.display = "none";
      this.pickDeliverForm.style.display = "none";

      if (this.itemsContainer.children.length === 0) {
        this.addItemField();
      }
    } else if (this.formData.serviceType === "delivery") {
      this.budgetSection.style.display = "none";
      this.budgetLimit.value = "";
      this.groceriesItemsForm.style.display = "none";
      this.pickDeliverForm.style.display = "block";
      this.itemsList.style.display = "none";
      this.itemsHelper.style.display = "none";

      const locationEl = document.getElementById("locationName");
      if (locationEl) {
        this.currentLocationDisplay.textContent = locationEl.textContent;
      }

      if (this.pickupItemsContainer.children.length === 0) {
        this.addPickupItemField();
      }

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

    const title = document.querySelector("#step1 h3");
    if (title) {
      title.style.color = "#28a745";
      setTimeout(() => {
        title.style.color = "#333";
      }, 300);
    }
  }

  // ===== ITEM MANAGEMENT =====

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
          ? `<button type="button" class="item-remove-btn"><i class="fa-solid fa-trash"></i></button>`
          : ""
      }
    `;

    const removeBtn = itemGroup.querySelector(".item-remove-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.removeItemField(itemGroup);
      });
    }

    this.itemsContainer.appendChild(itemGroup);
    itemGroup.querySelector("input").focus();
    console.log(`➕ Item field ${itemNumber} added`);
  }

  removeItemField(itemGroup) {
    itemGroup.style.animation = "slideOutDown 0.3s ease";
    setTimeout(() => {
      itemGroup.remove();
      this.updateItemLabels();
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
          ? `<button type="button" class="item-remove-btn"><i class="fa-solid fa-trash"></i></button>`
          : ""
      }
    `;

    const removeBtn = itemGroup.querySelector(".item-remove-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.removePickupItemField(itemGroup);
      });
    }

    this.pickupItemsContainer.appendChild(itemGroup);
    itemGroup.querySelector("input").focus();
  }

  removePickupItemField(itemGroup) {
    itemGroup.style.animation = "slideOutDown 0.3s ease";
    setTimeout(() => {
      itemGroup.remove();
      this.updatePickupItemLabels();
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
    this.vehicleCards.forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    this.formData.vehicleType = card.dataset.vehicle;
    console.log(`🚗 Selected vehicle: ${this.formData.vehicleType}`);
  }

  // ===== FILE UPLOADS =====

  handlePhotoUpload(files) {
    const maxFiles = 5;
    const maxFileSize = 10 * 1024 * 1024;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        alert("Please upload image files only");
        return;
      }

      if (file.size > maxFileSize) {
        alert("File size must be less than 10MB");
        return;
      }

      if (this.formData.billPhotos.length >= maxFiles) {
        alert(`Maximum ${maxFiles} photos allowed`);
        return;
      }

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
    this.photoPreviewContainer.innerHTML = "";
    this.formData.billPhotos.forEach((photo, i) => {
      this.displayPhotoPreview(photo, i);
    });
    this.billPhotoInput.value = "";
  }

  handleFileUpload(files) {
    const maxFiles = 10;
    const maxFileSize = 25 * 1024 * 1024;

    Array.from(files).forEach((file) => {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" is too large. Maximum size is 25MB`);
        return;
      }

      if (this.formData.attachedFiles.length >= maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        return;
      }

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
    this.filePreviewContainer.innerHTML = "";
    this.formData.attachedFiles.forEach((file, i) => {
      this.displayFilePreview(file, i);
    });
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

  // ===== FORM SUBMISSION - REAL RIDER MATCHING =====

  async submitNewRequest() {
    console.log("🚀 Submitting request:", this.formData);

    this.updateConfirmationDisplay();

    if (!this.formData.serviceType || !this.formData.items) {
      alert("Please fill in all required fields");
      return;
    }

    // Add loading state
    this.submitRequest.disabled = true;
    this.submitRequest.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';

    try {
      // Update API token
      pasugoAPI.updateToken();

      // Prepare request data
      const requestData = {
        serviceType: this.formData.serviceType,
        itemsDescription: this.formData.items,
        budgetLimit: this.formData.budget || null,
        specialInstructions: this.formData.instructions || null,
        pickupLocation: this.formData.pickupLocation || null,
        deliveryAddress: this.formData.deliveryAddress || null,
        deliveryOption: this.formData.deliveryOption || null,
      };

      // Call API to create request
      const result = await pasugoAPI.createRequest(requestData);

      if (!result.success) {
        alert("Error: " + result.message);
        return;
      }

      // Get request ID from response
      this.requestId = result.data.request_id;
      console.log("✅ Request created with ID:", this.requestId);

      // Close form modal
      this.requestModalOverlay.style.display = "none";

      // Show rider selection instead of fake waiting
      this.showRiderSelection();
    } catch (error) {
      console.error("❌ Submit error:", error);
      alert("Failed to create request: " + error.message);
    } finally {
      this.submitRequest.disabled = false;
      this.submitRequest.innerHTML = "Find a Rider";
    }
  }

  // NEW METHOD: Show rider selection modal
  async showRiderSelection() {
    console.log("👥 Showing rider selection...");

    // Show waiting modal with different message
    this.waitingModalOverlay.style.display = "flex";
    this.waitingStatus.textContent = "Finding available riders nearby...";

    if (this.modalBackdrop) {
      this.modalBackdrop.classList.add("active");
    }

    // Get user's location from map
    const userPosition = pasugoMap ? pasugoMap.userPosition : null;

    if (!userPosition) {
      alert("Unable to get your location. Please try again.");
      this.closeWaitingModal();
      return;
    }

    try {
      // Fetch nearby riders using existing API
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `https://pasugo.onrender.com/api/locations/riders/available?lat=${userPosition.lat}&lng=${userPosition.lng}&radius=10&limit=5`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch riders");
      }

      const data = await response.json();

      if (!data.riders || data.riders.length === 0) {
        this.waitingStatus.innerHTML = `
          <p style="color: #dc3545;">No riders available nearby</p>
          <p style="font-size: 12px; margin-top: 10px;">Please try again in a few moments</p>
        `;
        setTimeout(() => {
          this.closeWaitingModal();
        }, 3000);
        return;
      }

      // Display rider list
      this.displayRiderList(data.riders);
    } catch (error) {
      console.error("❌ Error fetching riders:", error);
      alert("Failed to find riders. Please try again.");
      this.closeWaitingModal();
    }
  }

  // NEW METHOD: Display list of available riders
  displayRiderList(riders) {
    const waitingContent = this.waitingModal.querySelector(".waiting-content");

    waitingContent.innerHTML = `
      <h3 style="margin-bottom: 20px;">Select a Rider</h3>
      <p style="font-size: 13px; color: #666; margin-bottom: 20px;">
        ${riders.length} rider${riders.length > 1 ? "s" : ""} available nearby
      </p>
      
      <div class="rider-list" style="max-height: 400px; overflow-y: auto;">
        ${riders
          .map(
            (rider) => `
          <div class="rider-card" data-rider-id="${rider.rider_id}" style="
            background: white;
            border: 2px solid #eee;
            border-radius: 15px;
            padding: 15px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="display: flex; align-items: center; gap: 15px;">
              <div style="
                width: 50px;
                height: 50px;
                background: #ffc107;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
              ">
                <i class="fa-solid fa-motorcycle"></i>
              </div>
              <div style="flex-grow: 1;">
                <h4 style="margin: 0; font-size: 16px;">${rider.full_name}</h4>
                <p style="margin: 4px 0; font-size: 12px; color: #666;">
                  ${rider.vehicle_type} - ${rider.license_plate}
                </p>
                <p style="margin: 0; font-size: 12px;">
                  ⭐ ${rider.rating ? rider.rating.toFixed(1) : "New"} 
                  (${rider.total_tasks_completed} rides) • 
                  <strong>${rider.distance_km ? rider.distance_km.toFixed(1) : "0.0"}km away</strong>
                </p>
              </div>
              <i class="fa-solid fa-chevron-right" style="color: #ccc;"></i>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
      
      <button class="btn-secondary" id="cancelRiderSelection" style="margin-top: 20px;">
        Cancel
      </button>
    `;

    // Add click handlers for rider cards
    const riderCards = waitingContent.querySelectorAll(".rider-card");
    riderCards.forEach((card) => {
      card.addEventListener("click", () => {
        const riderId = parseInt(card.dataset.riderId);
        this.selectRiderById(
          riderId,
          riders.find((r) => r.rider_id === riderId),
        );
      });

      // Hover effect
      card.addEventListener("mouseenter", () => {
        card.style.borderColor = "#ffc107";
        card.style.transform = "scale(1.02)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.borderColor = "#eee";
        card.style.transform = "scale(1)";
      });
    });

    // Cancel button
    const cancelBtn = waitingContent.querySelector("#cancelRiderSelection");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        // Cancel the request
        await pasugoAPI.cancelRequest(this.requestId);
        this.closeWaitingModal();
        this.resetForm();
      });
    }
  }

  // NEW METHOD: Customer selects a specific rider
  async selectRiderById(riderId, riderData) {
    console.log(`👤 Customer selected rider ${riderId}`);

    const waitingContent = this.waitingModal.querySelector(".waiting-content");

    waitingContent.innerHTML = `
      <div class="pulse-animation">
        <i class="fa-solid fa-motorcycle"></i>
      </div>
      <h3>Notifying ${riderData.full_name}...</h3>
      <p style="font-size: 13px; color: #666; margin-top: 10px;">
        Waiting for rider to accept your request
      </p>
      <div class="waiting-timer" style="margin-top: 20px;">
        <span id="waitingTime">0:00</span>
      </div>
    `;

    try {
      // Send selection to backend
      const result = await pasugoAPI.selectRider(this.requestId, riderId);

      if (!result.success) {
        alert("Failed to select rider: " + result.message);
        this.closeWaitingModal();
        return;
      }

      console.log("✅ Rider notified:", result.data);

      // Start polling for rider response
      this.startPollingForRiderResponse();
    } catch (error) {
      console.error("❌ Error selecting rider:", error);
      alert("Failed to notify rider");
      this.closeWaitingModal();
    }
  }

  // NEW METHOD: Poll request status waiting for rider to accept
  startPollingForRiderResponse() {
    this.isWaiting = true;
    this.waitingTimer = 0;

    // Update timer display
    this.waitingTimerId = setInterval(() => {
      this.waitingTimer++;
      const minutes = Math.floor(this.waitingTimer / 60);
      const seconds = this.waitingTimer % 60;
      const timeEl = document.getElementById("waitingTime");
      if (timeEl) {
        timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      }

      // Timeout after 10 minutes (600 seconds)
      if (this.waitingTimer >= 600) {
        this.handleRiderTimeout();
      }
    }, 1000);

    // Poll status every 3 seconds
    this.statusPollInterval = setInterval(async () => {
      const result = await pasugoAPI.pollRequestStatus(this.requestId);

      if (result.success) {
        const { status, timed_out, rider_info } = result.data;

        // Check if timed out
        if (timed_out) {
          this.handleRiderTimeout();
          return;
        }

        // Check if rider accepted
        if (status === "assigned" && rider_info) {
          this.handleRiderAccepted(rider_info);
          return;
        }

        // Check if rider declined (status still pending but no selected_rider_id)
        if (status === "pending" && !result.data.selected_rider_id) {
          this.handleRiderDeclined();
          return;
        }
      }
    }, 3000);
  }

  // NEW METHOD: Handle rider timeout
  handleRiderTimeout() {
    this.stopWaitingTimer();
    this.stopStatusPolling();

    const waitingContent = this.waitingModal.querySelector(".waiting-content");
    waitingContent.innerHTML = `
      <i class="fa-solid fa-clock" style="font-size: 60px; color: #dc3545; margin-bottom: 20px;"></i>
      <h3>Rider didn't respond</h3>
      <p style="font-size: 13px; color: #666; margin: 15px 0;">
        The rider didn't accept within 10 minutes
      </p>
      <button class="btn-primary" id="selectAnotherRider">
        Select Another Rider
      </button>
    `;

    const btn = waitingContent.querySelector("#selectAnotherRider");
    if (btn) {
      btn.addEventListener("click", () => {
        this.showRiderSelection();
      });
    }
  }

  // NEW METHOD: Handle rider declined
  handleRiderDeclined() {
    this.stopWaitingTimer();
    this.stopStatusPolling();

    const waitingContent = this.waitingModal.querySelector(".waiting-content");
    waitingContent.innerHTML = `
      <i class="fa-solid fa-circle-xmark" style="font-size: 60px; color: #dc3545; margin-bottom: 20px;"></i>
      <h3>Rider Declined</h3>
      <p style="font-size: 13px; color: #666; margin: 15px 0;">
        The rider is not available for this request
      </p>
      <button class="btn-primary" id="selectAnotherRider">
        Select Another Rider
      </button>
    `;

    const btn = waitingContent.querySelector("#selectAnotherRider");
    if (btn) {
      btn.addEventListener("click", () => {
        this.showRiderSelection();
      });
    }
  }

  // NEW METHOD: Handle rider accepted
  handleRiderAccepted(riderInfo) {
    console.log("🎉 Rider accepted!", riderInfo);

    this.stopWaitingTimer();
    this.stopStatusPolling();

    this.showChatWithRider(riderInfo);
  }

  // NEW METHOD: Stop status polling
  stopStatusPolling() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
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

    if (this.formData.serviceType === "pickup") {
      this.confVehicleItem.style.display = "flex";
      this.confVehicle.textContent =
        vehicleNames[this.formData.vehicleType] || "-";
    } else {
      this.confVehicleItem.style.display = "none";
    }

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

    const locationEl = document.getElementById("locationName");
    if (locationEl) {
      this.confLocation.textContent = locationEl.textContent;
    }
  }

  // ===== WAITING MODAL =====

  stopWaitingTimer() {
    if (this.waitingTimerId) {
      clearInterval(this.waitingTimerId);
      this.waitingTimerId = null;
    }
    this.stopStatusPolling();
  }

  async cancelRequest() {
    console.log("❌ Cancelling request");

    if (confirm("Are you sure you want to cancel this request?")) {
      try {
        // Update API token
        pasugoAPI.updateToken();

        // Call API to cancel request
        const result = await pasugoAPI.cancelRequest(this.requestId);

        if (result.success) {
          this.closeWaitingModal();
          this.resetForm();
          alert("Request cancelled successfully");
        } else {
          alert("Error: " + result.message);
        }
      } catch (error) {
        console.error("Cancel error:", error);
        alert("Failed to cancel request");
      }
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

    this.chatContainer.innerHTML = `
      <div class="message-group system">
        <div class="message-bubble system">
          <strong>${rider.name}</strong> accepted your request
        </div>
      </div>
    `;

    setTimeout(() => {
      this.addRiderMessage(
        `Hi! I'll help you with your ${this.formData.serviceType} request. Let me get started! 👍`,
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
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  sendMessage() {
    const message = this.messageInput.value.trim();

    if (!message) return;

    this.addCustomerMessage(message);
    this.messageInput.value = "";

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
      attachedFiles: [],
      items: "",
      budget: 0,
      instructions: "",
      location: null,
    };

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
