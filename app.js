const state = {
  currentOdometer: null,
  isSubmitting: false,
  auto: new URLSearchParams(window.location.search).get("auto"),
};

const storageKey = "kniha-jizd.driver-name";
const timestampFormatter = new Intl.DateTimeFormat("cs-CZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Prague",
});

const form = document.querySelector("#trip-form");
const endOdometerInput = document.querySelector("#end-odometer");
const fromInput = document.querySelector("#from");
const toInput = document.querySelector("#to");
const driverNameInput = document.querySelector("#driver-name");
const reasonInput = document.querySelector("#reason");
const currentOdometerNode = document.querySelector("#current-odometer");
const currentTimestampNode = document.querySelector("#current-timestamp");
const startPreviewNode = document.querySelector("#start-preview");
const distancePreviewNode = document.querySelector("#distance-preview");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");

boot();

async function boot() {
  if (state.auto) {
    const carName = state.auto.replace(/_/g, " ");
    const h1 = document.querySelector(".hero h1");
    if (h1) h1.textContent = carName;
  }

  currentTimestampNode.textContent = timestampFormatter.format(new Date());

  const storedName = window.localStorage.getItem(storageKey);
  if (storedName) {
    driverNameInput.value = storedName;
  }

  endOdometerInput.addEventListener("input", updateDistancePreview);
  driverNameInput.addEventListener("change", persistDriverName);
  form.addEventListener("submit", handleSubmit);

  window.addEventListener("beforeunload", (event) => {
    if (state.isSubmitting) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  await loadCurrentState();
}

async function loadCurrentState() {
  setMessage("Načítám poslední stav z tabulky…");

  try {
    const url = new URL("/api/state", window.location.origin);
    if (state.auto) url.searchParams.set("auto", state.auto);

    const response = await fetch(url);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Nepodařilo se načíst data.");
    }

    state.currentOdometer = payload.currentOdometer;
    currentOdometerNode.textContent = formatKilometers(payload.currentOdometer);
    startPreviewNode.textContent = formatKilometers(payload.currentOdometer);
    currentTimestampNode.textContent = timestampFormatter.format(new Date(payload.timestamp));
    setMessage("");
    updateDistancePreview();
  } catch (error) {
    state.currentOdometer = null;
    currentOdometerNode.textContent = "Nelze načíst";
    startPreviewNode.textContent = "-";
    setMessage(error.message, "error");
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  if (state.isSubmitting) {
    return;
  }

  const endOdometer = Number(endOdometerInput.value);
  const payload = {
    endOdometer,
    from: fromInput.value.trim(),
    to: toInput.value.trim(),
    driverName: driverNameInput.value.trim(),
    reason: reasonInput.value.trim(),
    auto: state.auto,
  };

  if (!state.currentOdometer && state.currentOdometer !== 0) {
    setMessage("Nejprve je potřeba načíst poslední stav tachometru.", "error");
    return;
  }

  if (!Number.isFinite(endOdometer)) {
    setMessage("Vyplňte prosím koncový stav tachometru.", "error");
    return;
  }

  if (endOdometer < state.currentOdometer) {
    setMessage("Koncový stav tachometru nesmí být menší než poslední stav v tabulce.", "error");
    return;
  }

  if (!payload.from || !payload.to || !payload.driverName || !payload.reason) {
    setMessage("Vyplňte prosím všechna pole formuláře.", "error");
    return;
  }

  persistDriverName();
  setSubmitting(true);
  setMessage("Odesílám záznam do tabulky…");

  try {
    const response = await fetch("/api/trips", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      const detail = result.upstream?.error || result.upstream?.raw || "";
      throw new Error(detail ? `${result.error || "Zápis se nepodařil."} Detail: ${detail}` : result.error || "Zápis se nepodařil.");
    }

    state.currentOdometer = result.record.endOdometer;
    currentOdometerNode.textContent = formatKilometers(result.record.endOdometer);
    startPreviewNode.textContent = formatKilometers(result.record.endOdometer);
    currentTimestampNode.textContent = timestampFormatter.format(new Date(result.record.createdAtIso));
    distancePreviewNode.textContent = "0 km";

    endOdometerInput.value = "";
    fromInput.value = "";
    toInput.value = "";
    reasonInput.value = "";

    setSubmitting(true, true);
    setTimeout(() => {
      setSubmitting(false);
      setMessage(
        `Zapsáno. Uloženo ${result.record.distanceKm} km pro řidiče ${result.record.driverName}.`,
        "success",
      );
    }, 2000);
  } catch (error) {
    setSubmitting(false);
    setMessage(error.message, "error");
  }
}

function updateDistancePreview() {
  const endOdometer = Number(endOdometerInput.value);

  if (!Number.isFinite(endOdometer) || !Number.isFinite(state.currentOdometer)) {
    distancePreviewNode.textContent = "-";
    return;
  }

  const distance = endOdometer - state.currentOdometer;
  distancePreviewNode.textContent = distance >= 0 ? `${distance} km` : "Neplatná hodnota";
}

function persistDriverName() {
  const name = driverNameInput.value.trim();

  if (name) {
    window.localStorage.setItem(storageKey, name);
  }
}

function setSubmitting(isSubmitting, isSuccess = false) {
  state.isSubmitting = isSubmitting;
  submitButton.disabled = isSubmitting;

  const loaderOverlay = document.getElementById("loader-overlay");
  const loaderText = document.getElementById("loader-text");
  const spinner = loaderOverlay?.querySelector(".spinner");
  const successIcon = loaderOverlay?.querySelector(".success-icon");

  if (loaderOverlay) {
    loaderOverlay.hidden = !isSubmitting;
    loaderOverlay.setAttribute("aria-hidden", !isSubmitting);

    if (isSubmitting) {
      if (isSuccess) {
        if (spinner) spinner.hidden = true;
        if (successIcon) successIcon.hidden = false;
        if (loaderText) loaderText.textContent = "Zapsáno v pořádku!";
      } else {
        if (spinner) spinner.hidden = false;
        if (successIcon) successIcon.hidden = true;
        if (loaderText) loaderText.textContent = "Zapisuji do tabulky…";
      }
    }
  }
}

function setMessage(message, type = "") {
  formMessage.textContent = message;
  formMessage.className = "form-message";

  if (type === "error") {
    formMessage.classList.add("is-error");
  }

  if (type === "success") {
    formMessage.classList.add("is-success");
  }
}

function formatKilometers(value) {
  return `${new Intl.NumberFormat("cs-CZ").format(value)} km`;
}
