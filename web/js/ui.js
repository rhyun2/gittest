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
 * 장소 목록을 두 구획으로 그린다. 위가 직접 정리한 장소, 아래가 카카오 실시간 결과다.
 * 각 배열은 이미 거리순으로 정렬돼 있다 (카카오는 서버가, 큐레이션은 curated.js 가).
 *
 * @param {{curated: Array<object>, nearby: Array<object>}} sections
 */
export function renderPlaces({ curated = [], nearby = [] } = {}) {
  content.setAttribute("aria-busy", "false");

  const wrapper = document.createDocumentFragment();

  if (curated.length > 0) {
    wrapper.append(buildSectionBadge(`직접 정리한 장소 ${curated.length}곳`));
    wrapper.append(buildList(curated));
  }
  if (nearby.length > 0) {
    wrapper.append(buildSectionBadge(`카카오맵 검색 결과 ${nearby.length}곳`));
    wrapper.append(buildList(nearby));
  }

  replace(wrapper);
}

function buildList(places) {
  const list = document.createElement("ol");
  list.className = "place-list";
  // 사진이 섞여 있으면 없는 항목의 왼쪽 정렬이 어긋난다. 자리만 비워 맞춰 준다.
  if (places.some((place) => place.image)) list.classList.add("place-list--with-thumbs");

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

    if (place.image) {
      const thumb = item.querySelector(".place-thumb");
      thumb.src = place.image;
      thumb.hidden = false;
      // 이미지가 깨져도 레이아웃이 무너지지 않게 조용히 감춘다.
      thumb.addEventListener("error", () => {
        thumb.hidden = true;
      });
    }

    item.querySelector(".place-name").textContent = place.name;
    item.querySelector(".place-category").textContent = place.category;
    item.querySelector(".place-address").textContent = place.address ?? "";
    // 한줄평(직접 적은 메모)을 요약보다 앞세운다. 사람이 쓴 쪽이 더 쓸모 있다.
    item.querySelector(".place-summary").textContent = place.note || place.summary || "";

    const distance = item.querySelector(".place-distance");
    distance.textContent = formatDistance(place.distanceMeters);
    // 스크린리더가 "231m"를 그대로 읽으면 무슨 값인지 모른다.
    distance.setAttribute("aria-label", `직선거리 ${formatDistance(place.distanceMeters)}`);

    if (typeof place.rating === "number") {
      const rating = item.querySelector(".place-rating");
      rating.textContent = `★ ${place.rating.toFixed(1)}`;
      rating.setAttribute("aria-label", `평점 5점 만점에 ${place.rating.toFixed(1)}점`);
      rating.hidden = false;
    }

    list.append(item);
  }

  return list;
}

function buildSectionBadge(text) {
  const badge = document.createElement("p");
  badge.className = "source-badge";
  badge.textContent = text;
  return badge;
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
