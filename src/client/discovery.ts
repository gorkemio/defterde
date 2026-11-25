import {
  readFilters,
  filterParams,
  matchesGame,
  chooseGame,
  type Category,
  type Player,
} from '../lib/discovery';

const root = document.getElementById('discovery')!;
const form = root.querySelector<HTMLFormElement>('form')!;
const search = form.querySelector<HTMLInputElement>('[name=q]')!;
const category = form.querySelector<HTMLSelectElement>('[name=tur]')!;
const playerInputs = [
  ...form.querySelectorAll<HTMLInputElement>('[name=oyuncu]'),
];
const randomButton =
  form.querySelector<HTMLButtonElement>('.discovery-random')!;
const pick = document.getElementById('discovery-pick')!;
const pickLink = document.getElementById('pick-link') as HTMLAnchorElement;
const pickImage = document.getElementById('pick-image') as HTMLImageElement;
const announcement = document.getElementById('pick-announcement')!;
const count = document.getElementById('discovery-count')!;
const empty = document.getElementById('discovery-empty')!;
const entries = [...root.querySelectorAll<HTMLElement>('[data-slug]')].map(
  (element) => ({
    element,
    slug: element.dataset.slug!,
    categories: element.dataset.categories!.split(' ') as Category[],
    players: element.dataset.players!.split(' ') as Player[],
    title: element.querySelector('h3')!.textContent!,
    description: element.querySelector('.discovery-description')!.textContent!,
    link: element.querySelector<HTMLAnchorElement>('a')!,
    image: element.querySelector<HTMLImageElement>('img')!,
  }),
);
let matches = entries.filter((g) => !g.element.hidden);
let previous: string | undefined;

function update(writeURL = true) {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) params.set(key, String(value));
  const filters = readFilters(params);
  matches = entries.filter((game) => {
    const match = matchesGame(game, filters);
    game.element.hidden = !match;
    return match;
  });
  count.textContent = `${matches.length} oyun`;
  empty.hidden = matches.length !== 0;
  randomButton.disabled = matches.length === 0;
  pick.hidden = true;
  announcement.textContent = '';
  previous = undefined;
  if (writeURL) {
    const url = new URL(location.href);
    url.search = filterParams(filters).toString();
    history.replaceState(history.state, '', url);
  }
}

function restore() {
  const filters = readFilters(new URLSearchParams(location.search));
  search.value = filters.q;
  category.value = filters.category;
  for (const input of playerInputs)
    input.checked = input.value === filters.player;
  update(false);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  update();
});
search.addEventListener('input', () => update());
category.addEventListener('change', () => update());
for (const input of playerInputs)
  input.addEventListener('change', () => update());
for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-clear]')) {
  link.addEventListener('click', (event) => {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    search.value = '';
    category.value = '';
    for (const input of playerInputs) input.checked = input.value === '';
    update();
    search.focus();
  });
}
randomButton.addEventListener('click', () => {
  const game = chooseGame(matches, previous);
  if (!game) return;
  previous = game.slug;
  pickLink.href = game.link.href;
  pickImage.src = game.image.src;
  document.getElementById('pick-title')!.textContent = game.title;
  document.getElementById('pick-description')!.textContent = game.description;
  pick.hidden = false;
  announcement.textContent = `Şunu dene: ${game.title}. Oyna bağlantısı önerinin içinde.`;
});
addEventListener('popstate', restore);
addEventListener('pageshow', restore);
restore();
randomButton.hidden = false;
form.querySelector<HTMLButtonElement>('.discovery-apply')!.hidden = true;
