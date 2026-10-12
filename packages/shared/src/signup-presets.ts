import type { BusinessCategory } from './schemas/org'

/** A question a business can add to its signup form with one click. */
export interface SignupPreset {
  key: string
  prompt: string
  type: 'text' | 'single_choice' | 'date'
  options: string[]
  /** One line on why a business like this tends to ask it. */
  help: string
}

const choice = (key: string, prompt: string, options: string[], help: string): SignupPreset => ({
  key,
  prompt,
  type: 'single_choice',
  options,
  help,
})
const text = (key: string, prompt: string, help: string): SignupPreset => ({
  key,
  prompt,
  type: 'text',
  options: [],
  help,
})
const date = (key: string, prompt: string, help: string): SignupPreset => ({
  key,
  prompt,
  type: 'date',
  options: [],
  help,
})

const LAST_NAME = text('last_name', 'Apellido', 'Para saludar con nombre completo.')
const ANNIVERSARY = date('anniversary', 'Aniversario', 'Una fecha especial para invitarles.')
const HOW_FOUND = choice(
  'how_found',
  '¿Cómo nos conociste?',
  ['Instagram', 'Un amigo', 'Pasé por la puerta', 'Google'],
  'Para saber qué te trae clientes.',
)
const ALLERGIES = text('allergies', 'Alergias o restricciones', 'Evita sorpresas en el plato.')

/**
 * Suggested signup fields by kind of business.
 *
 * Each entry is a question a business like this tends to want, written so it can be
 * used as-is. `any` applies to every category and comes last in the menu.
 */
export const SIGNUP_PRESETS: Record<BusinessCategory | 'any', SignupPreset[]> = {
  cafe: [
    choice(
      'favorite_drink',
      'Tu bebida favorita',
      ['Café', 'Té', 'Jugo', 'Batido'],
      'Para tenerla lista cuando entre.',
    ),
    ANNIVERSARY,
  ],
  restaurant: [
    text('favorite_dish', 'Tu plato favorito', 'Lo que siempre pide.'),
    ALLERGIES,
    ANNIVERSARY,
  ],
  bakery: [
    text('favorite_bread', 'Tu pan o postre favorito', 'Para avisarle cuando salga del horno.'),
    ALLERGIES,
  ],
  bar: [
    choice(
      'favorite_drink',
      'Tu trago de siempre',
      ['Cerveza', 'Vino', 'Cóctel', 'Sin alcohol'],
      'Para servirlo sin preguntar.',
    ),
    ANNIVERSARY,
  ],
  juice_bar: [text('favorite_drink', 'Tu jugo favorito', 'Para tenerlo listo.'), ALLERGIES],
  ice_cream: [
    text('favorite_flavor', 'Tu sabor favorito', 'Para recomendarle novedades parecidas.'),
    ALLERGIES,
  ],
  barber: [
    text('usual_cut', '¿Cómo prefieres tu corte?', 'Para que cualquier barbero lo sepa.'),
    text('preferred_barber', '¿Con quién te atiendes?', 'Para agendar con la persona de siempre.'),
  ],
  hair_salon: [
    text('usual_service', 'Tu servicio habitual', 'Corte, color, tratamiento…'),
    text('preferred_stylist', '¿Con quién te atiendes?', 'Para agendar con la persona de siempre.'),
  ],
  nail_salon: [
    choice(
      'usual_service',
      'Tu servicio habitual',
      ['Manicura', 'Pedicura', 'Uñas en gel', 'Acrílicas'],
      'Para reservar el tiempo justo.',
    ),
    text('favorite_color', 'Tu color favorito', 'Para proponerle tonos parecidos.'),
  ],
  beauty: [
    text('usual_service', 'Tu tratamiento habitual', 'Para reservar el tiempo justo.'),
    text('skin_notes', 'Alergias o sensibilidad', 'Evita reacciones en cabina.'),
  ],
  spa: [
    text('usual_service', 'Tu tratamiento habitual', 'Para reservar el tiempo justo.'),
    text('skin_notes', 'Alergias o sensibilidad', 'Evita reacciones en cabina.'),
  ],
  fitness: [
    choice(
      'goal',
      'Tu objetivo',
      ['Bajar de peso', 'Ganar músculo', 'Resistencia', 'Bienestar'],
      'Para recomendarle clases a medida.',
    ),
    choice(
      'preferred_time',
      '¿Cuándo sueles venir?',
      ['Mañana', 'Mediodía', 'Tarde', 'Noche'],
      'Para avisarle de los horarios que le sirven.',
    ),
  ],
  pet_grooming: [
    text('pet_name', 'Nombre de tu mascota', 'Para saludarla por su nombre.'),
    text('pet_breed', 'Raza', 'Para preparar el servicio adecuado.'),
  ],
  tattoo: [
    text('style', 'Estilo que te interesa', 'Para asignarle el artista indicado.'),
    text('preferred_artist', '¿Con quién te atiendes?', 'Para agendar con la persona de siempre.'),
  ],
  car_wash: [
    text('vehicle', 'Tu vehículo', 'Marca y modelo, para tener listo el servicio.'),
    text('plate', 'Placa', 'Para encontrar su historial al llegar.'),
  ],
  retail: [
    choice(
      'size',
      'Tu talla',
      ['XS', 'S', 'M', 'L', 'XL'],
      'Para avisarle cuando llegue algo de su talla.',
    ),
    HOW_FOUND,
  ],
  other: [HOW_FOUND],
  any: [LAST_NAME, HOW_FOUND],
}

/** The presets for a category, followed by the ones every business can use. */
export function presetsFor(category: string): SignupPreset[] {
  const own = SIGNUP_PRESETS[category as BusinessCategory] ?? []
  const seen = new Set(own.map((preset) => preset.key))
  return [...own, ...SIGNUP_PRESETS.any.filter((preset) => !seen.has(preset.key))]
}
