export const MARCAS = {
  'super-bock': { nome: 'Super Bock', cor: '#003087', icon: 'fa-beer-mug-empty' },
  'sumol':      { nome: 'Sumol',      cor: '#E31E24', icon: 'fa-bottle-water'   },
};

export const CATEGORIAS = {
  'super-bock': [
    {
      nome: 'Cervejas Super Bock',
      produtos: [
        { id: 'sb-or-33', nome: 'Super Bock Original 33cl',   ref: 'SB-OR-33', unidade: 'Pack 24' },
        { id: 'sb-or-50', nome: 'Super Bock Original 50cl',   ref: 'SB-OR-50', unidade: 'Pack 24' },
        { id: 'sb-st-33', nome: 'Super Bock Stout 33cl',      ref: 'SB-ST-33', unidade: 'Pack 24' },
        { id: 'sb-gr-33', nome: 'Super Bock Green 33cl',      ref: 'SB-GR-33', unidade: 'Pack 24' },
        { id: 'sb-sa-33', nome: 'Super Bock Sem Álcool 33cl', ref: 'SB-SA-33', unidade: 'Pack 24' },
        { id: 'sb-ab-33', nome: 'Super Bock Abadia 33cl',     ref: 'SB-AB-33', unidade: 'Pack 24' },
        { id: 'sb-br-30', nome: 'Super Bock Barril 30L',      ref: 'SB-BR-30', unidade: 'Barril'  },
        { id: 'sb-br-50', nome: 'Super Bock Barril 50L',      ref: 'SB-BR-50', unidade: 'Barril'  },
      ],
    },
    {
      nome: 'Água das Pedras',
      produtos: [
        { id: 'ap-nt-50', nome: 'Água das Pedras Natural 50cl',   ref: 'AP-NT-50', unidade: 'Pack 12' },
        { id: 'ap-nt-15', nome: 'Água das Pedras Natural 1.5L',   ref: 'AP-NT-15', unidade: 'Pack 6'  },
        { id: 'ap-gs-50', nome: 'Água das Pedras Com Gás 50cl',   ref: 'AP-GS-50', unidade: 'Pack 12' },
        { id: 'ap-gs-15', nome: 'Água das Pedras Com Gás 1.5L',   ref: 'AP-GS-15', unidade: 'Pack 6'  },
      ],
    },
    {
      nome: 'Frisumo',
      produtos: [
        { id: 'fr-la-33', nome: 'Frisumo Laranja 33cl', ref: 'FR-LA-33', unidade: 'Pack 24' },
        { id: 'fr-pe-33', nome: 'Frisumo Pêssego 33cl', ref: 'FR-PE-33', unidade: 'Pack 24' },
      ],
    },
  ],

  'sumol': [
    {
      nome: 'Sumol',
      produtos: [
        { id: 'su-la-33', nome: 'Sumol Laranja 33cl',  ref: 'SU-LA-33', unidade: 'Pack 24' },
        { id: 'su-an-33', nome: 'Sumol Ananás 33cl',   ref: 'SU-AN-33', unidade: 'Pack 24' },
        { id: 'su-la-15', nome: 'Sumol Laranja 1.5L',  ref: 'SU-LA-15', unidade: 'Pack 6'  },
        { id: 'su-mn-33', nome: 'Sumol Manga 33cl',    ref: 'SU-MN-33', unidade: 'Pack 24' },
      ],
    },
    {
      nome: 'Compal',
      produtos: [
        { id: 'co-la-20', nome: 'Compal Laranja 20cl',        ref: 'CO-LA-20', unidade: 'Pack 24' },
        { id: 'co-ma-20', nome: 'Compal Maçã 20cl',           ref: 'CO-MA-20', unidade: 'Pack 24' },
        { id: 'co-pe-20', nome: 'Compal Pêssego 20cl',        ref: 'CO-PE-20', unidade: 'Pack 24' },
        { id: 'co-mn-20', nome: 'Compal Manga 20cl',          ref: 'CO-MN-20', unidade: 'Pack 24' },
        { id: 'co-cl-la', nome: 'Compal Clássico Laranja 1L', ref: 'CO-CL-LA', unidade: 'Pack 12' },
        { id: 'co-vt-33', nome: 'Compal Vital 33cl',          ref: 'CO-VT-33', unidade: 'Pack 24' },
      ],
    },
    {
      nome: 'Água Castello',
      produtos: [
        { id: 'ac-nt-50', nome: 'Água Castello Natural 50cl',  ref: 'AC-NT-50', unidade: 'Pack 12' },
        { id: 'ac-nt-15', nome: 'Água Castello Natural 1.5L',  ref: 'AC-NT-15', unidade: 'Pack 6'  },
        { id: 'ac-gs-50', nome: 'Água Castello Com Gás 50cl',  ref: 'AC-GS-50', unidade: 'Pack 12' },
      ],
    },
    {
      nome: 'Outros',
      produtos: [
        { id: 'pe-33',    nome: 'Pepsi 33cl',                   ref: 'PE-33',    unidade: 'Pack 24' },
        { id: '7up-33',   nome: '7UP 33cl',                     ref: '7UP-33',   unidade: 'Pack 24' },
        { id: 'lt-pe-33', nome: 'Lipton Ice Tea Pêssego 33cl',  ref: 'LT-PE-33', unidade: 'Pack 24' },
        { id: 'ga-33',    nome: 'Guaraná Antarctica 33cl',       ref: 'GA-33',    unidade: 'Pack 24' },
      ],
    },
  ],
};

// Mapa plano para lookups rápidos por id de produto
export const PRODUTOS_MAP = {};
Object.entries(CATEGORIAS).forEach(([marcaSlug, cats]) => {
  cats.forEach(cat => {
    cat.produtos.forEach(p => {
      PRODUTOS_MAP[p.id] = { ...p, categoria: cat.nome, marcaSlug };
    });
  });
});
