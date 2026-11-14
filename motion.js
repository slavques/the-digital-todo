const gsap = window.gsap;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const active = new Set();
function tween(target, from, to) {
  if (!gsap || reduced.matches) return;
  const animation = gsap.fromTo(target, from, {
    overwrite: "auto",
    ...to,
    onInterrupt() {
      active.delete(animation);
    },
    onComplete() {
      gsap.set(target, { clearProps: "transform,opacity" });
      active.delete(animation);
    },
  });
  active.add(animation);
}
export function captureRows(list) {
  const positions = new Map(
    [...list.children].map((el) => [
      el.dataset.id,
      el.getBoundingClientRect().top,
    ]),
  );
  if (gsap) for (const row of list.children) gsap.killTweensOf(row);
  return positions;
}
export function animateRows(list, previous, filterChange = false) {
  if (!gsap || reduced.matches) return;
  [...list.children].forEach((row, i) => {
    const top = previous.get(row.dataset.id);
    if (filterChange || top === undefined) {
      tween(
        row,
        { opacity: 0, y: filterChange ? 8 : -12, scaleX: 0.975, scaleY: 0.86 },
        {
          opacity: 1,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          duration: 0.62,
          delay: filterChange ? Math.min(i * 0.025, 0.12) : 0,
          ease: "elastic.out(1,0.6)",
        },
      );
    } else {
      const y = top - row.getBoundingClientRect().top;
      if (Math.abs(y) > 1)
        tween(row, { y }, { y: 0, duration: 0.4, ease: "power3.out" });
    }
  });
}
export function popToast(element) {
  tween(
    element,
    { opacity: 0, y: 18, scale: 0.94 },
    { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "elastic.out(1,0.65)" },
  );
}
let pressed;
function release() {
  if (!pressed) return;
  const target = pressed;
  pressed = null;
  if (!gsap) return;
  gsap.to(target, {
    scaleX: 1,
    scaleY: 1,
    duration: reduced.matches ? 0 : 0.55,
    ease: "elastic.out(1,0.4)",
    overwrite: "auto",
    clearProps: "transform",
  });
}
document.addEventListener("pointerdown", (event) => {
  const target = event.target.closest('button,input[type="checkbox"]');
  if (
    !target ||
    target.disabled ||
    event.button !== 0 ||
    !gsap ||
    reduced.matches
  )
    return;
  release();
  pressed = target;
  gsap.to(target, {
    scaleX: 1.035,
    scaleY: 0.88,
    duration: 0.1,
    overwrite: "auto",
    ease: "power2.out",
  });
});
for (const type of ["pointerup", "pointercancel", "keyup"])
  document.addEventListener(type, release);
window.addEventListener("blur", release);
document.addEventListener("keydown", (event) => {
  if (event.repeat || !["Enter", " "].includes(event.key)) return;
  const target = event.target.closest("button");
  if (target)
    tween(
      target,
      { scaleX: 1.04, scaleY: 0.88 },
      { scaleX: 1, scaleY: 1, duration: 0.55, ease: "elastic.out(1,0.4)" },
    );
});
function settle() {
  release();
  for (const animation of active) animation.progress(1);
  active.clear();
  if (gsap)
    gsap.killTweensOf(
      document.querySelectorAll(
        'button,.task,input[type="checkbox"],.feedback,.filter-indicator',
      ),
    );
  if (gsap)
    gsap.set(
      document.querySelectorAll(
        'button,.task,input[type="checkbox"],.feedback,.filter-indicator',
      ),
      { clearProps: "transform,opacity" },
    );
  moveFilter();
}
reduced.addEventListener("change", () => {
  if (reduced.matches) settle();
});
window.addEventListener("pagehide", settle);

const filters = document.querySelector(".filters");
const indicator = document.createElement("span");
indicator.className = "filter-indicator";
indicator.setAttribute("aria-hidden", "true");
filters.append(indicator);
let indicatorPosition = 0,
  indicatorWidth = 1;
export function moveFilter() {
  const selected = filters.querySelector('[aria-pressed="true"]');
  if (!selected) return;
  const x = selected.offsetLeft,
    width = selected.offsetWidth;
  indicator.style.width = width + "px";
  if (gsap && !reduced.matches)
    gsap.fromTo(
      indicator,
      { x: indicatorPosition, scaleX: indicatorWidth / width },
      {
        x,
        scaleX: 1,
        duration: 0.5,
        ease: "elastic.out(1,0.65)",
        overwrite: true,
      },
    );
  else indicator.style.transform = `translateX(${x}px)`;
  indicatorPosition = x;
  indicatorWidth = width;
}
new ResizeObserver(moveFilter).observe(filters);

const taskList = document.querySelector("#tasks");
taskList.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const row = event.target.closest(".task");
  for (const item of taskList.children)
    item.toggleAttribute("data-hovered", item === row);
});
taskList.addEventListener("pointerleave", () => {
  for (const item of taskList.children) item.removeAttribute("data-hovered");
});
export function hideToast(element, done) {
  if (!gsap || reduced.matches) {
    done();
    return;
  }
  gsap.to(element, {
    opacity: 0,
    y: 10,
    scale: 0.97,
    duration: 0.18,
    ease: "power2.in",
    overwrite: true,
    onComplete() {
      done();
      gsap.set(element, { clearProps: "transform,opacity" });
    },
  });
}

// Read the live progress before a re-render so rapid toggles reverse smoothly.
export function captureStrikes(list) {
  const states = new Map();
  for (const row of list.children) {
    const text = row.querySelector(".task-text");
    states.set(row.dataset.id, {
      done: row.classList.contains("completed"),
      progress:
        getComputedStyle(text).getPropertyValue("--strike").trim() || "0%",
    });
    if (gsap) gsap.killTweensOf(text);
  }
  return states;
}
export function animateStrikes(list, previous) {
  for (const row of list.children) {
    const text = row.querySelector(".task-text");
    const done = row.classList.contains("completed");
    const old = previous.get(row.dataset.id);
    if (!gsap || reduced.matches || !old) continue;
    const target = done ? "100%" : "0%";
    if (old.progress === target) continue;
    const animation = gsap.fromTo(
      text,
      { "--strike": old.progress },
      {
        "--strike": target,
        duration: 0.38,
        ease: "power2.inOut",
        overwrite: true,
        onComplete() {
          text.style.removeProperty("--strike");
          active.delete(animation);
        },
        onInterrupt() {
          active.delete(animation);
        },
      },
    );
    active.add(animation);
  }
}

export function captureRegion(region) {
  const height = region.getBoundingClientRect().height;
  if (gsap) gsap.killTweensOf(region);
  region.style.removeProperty("height");
  return height;
}
export function animateRegion(region, previousHeight) {
  if (!gsap || reduced.matches) return;
  const height = region.getBoundingClientRect().height;
  if (Math.abs(height - previousHeight) < 1) return;
  const animation = gsap.fromTo(
    region,
    { height: previousHeight },
    {
      height,
      duration: 0.42,
      ease: "power3.inOut",
      overwrite: true,
      onComplete() {
        region.style.removeProperty("height");
        active.delete(animation);
      },
      onInterrupt() {
        active.delete(animation);
      },
    },
  );
  active.add(animation);
}
window.addEventListener("resize", () => {
  const region = document.querySelector(".task-region");
  if (gsap) gsap.killTweensOf(region);
  region.style.removeProperty("height");
});
