/**
 * 렌더링. 상태를 받아 #content 안을 다시 그린다.
 *
 * 장소 이름·주소는 외부에서 온 문자열이므로 전부 textContent로만 넣는다.
 * innerHTML을 쓰지 않으므로 HTML 주입 여지가 없다.
 */
import { CATEGORIES, formatDistance } from "./kakao.js";

const content = document.getElementById("content");
const placeTemplate = document.getElementById("place-item-template");
const messageTemplate = document.getElementById("message-template");

/** 카테고리 탭과 반경 탭을 만든다. 선택이 바뀌면 onChange를 부른다. */
export function buildTabs({ radiusOptions, onCategoryChange, onRadiusChange }) {
  const categoryTabs = document.getElementById("category-tabs");
  const radiusTabs = document.getElementById("radius-tabs");

  CATEGORIES.forEach(({ code, label }) => {
    categoryTabs.append(
      makeTab({ role: "tab", value: code, label, onSelect: onCategoryChange })
    );
  });

  radiusOptions.forEach((meters) => {
    radiusTabs.append(
      makeTab({
        role: "radio",
        value: String(meters),
        label: formatRadius(meters),
        onSelect: (value) => onRadiusChange(Number(value)),
      })
    );
  });
}

function makeTab({ role, value, label, onSelect }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "segment";
  button.dataset.value = value;
  button.textContent = label;
  button.setAttribute("role", role);
  button.setAttribute("aria-checked", "false");
  button.setAttribute("aria-selected", "false");
  button.addEventListener("click", () => onSelect(value));
  return button;
}

/** 선택 상태를 탭에 반영한다. */
export function syncTabs({ category, radius }) {
  markSelected("category-tabs", category);
  markSelected("radius-tabs", String(radius));
}

function markSelected(containerId, value) {
  const container = document.getElementById(containerId);
  for (const button of container.querySelectorAll(".segment")) {
    const selected = button.dataset.value === value;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", String(selected));
    button.setAttribute("aria-checked", String(selected));
  }
}

export function renderLoading(message = "주변을 찾는 중…") {
  content.setAttribute("aria-busy", "true");
  replace(buildMessage({ icon: "◌", title: message, body: "" }));
}

/**
 * 장소 목록. 카카오가 거리순으로 정렬해 준 순서를 그대로 쓴다.
 * @param {Array<object>} places
 */
export function renderPlaces(places) {
  content.setAttribute("aria-busy", "false");

  const list = document.createElement("ol");
  list.className = "place-list";

  for (const place of places) {
    const item = placeTemplate.content.cloneNode(true);

    const link = item.querySelector(".place-link");
    if (place.placeUrl) {
      link.href = place.placeUrl;
    } else {
      // 상세 페이지가 없는 장소는 링크가 아니라 그냥 항목으로 둔다.
      link.removeAttribute("target");
      link.removeAttribute("rel");
    }

    item.querySelector(".place-name").textContent = place.name;
    item.querySelector(".place-category").textContent = place.category;
    item.querySelector(".place-address").textContent = place.address;

    const distance = item.querySelector(".place-distance");
    distance.textContent = formatDistance(place.distanceMeters);
    // 스크린리더가 "231m"를 그대로 읽으면 무슨 값인지 모른다.
    distance.setAttribute("aria-label", `직선거리 ${formatDistance(place.distanceMeters)}`);

    list.append(item);
  }

  replace(list);
}

/**
 * 안내·오류 화면.
 * @param {{icon: string, title: string, body: string, actions?: Array<{label: string, onClick: Function}>}} options
 */
export function renderMessage(options) {
  content.setAttribute("aria-busy", "false");
  replace(buildMessage(options));
}

function buildMessage({ icon, title, body, actions = [] }) {
  const node = messageTemplate.content.cloneNode(true);
  node.querySelector(".message-icon").textContent = icon;
  node.querySelector(".message-title").textContent = title;
  node.querySelector(".message-body").textContent = body;

  const actionsContainer = node.querySelector(".message-actions");
  for (const { label, onClick } of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    actionsContainer.append(button);
  }
  return node;
}

function replace(node) {
  content.replaceChildren(node);
}

export function formatRadius(meters) {
  return meters < 1000 ? `${meters}m` : `${meters / 1000}km`;
}
