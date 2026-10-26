// Presentation only: keep model paths, transforms and wire types in products.js.
import { families, resolveProduct } from './configuration.js';

export const categories = [
  {
    id: 'desks',
    label: 'Desks',
  },
  {
    id: 'monitors',
    label: 'Monitors',
  },
  {
    id: 'keyboards',
    label: 'Keyboards',
  },
  {
    id: 'mice',
    label: 'Mouse',
  },
  {
    id: 'mousepads',
    label: 'Mousepads',
  },
  {
    id: 'audio',
    label: 'Speakers and Audio Equipment',
  },
  {
    id: 'laptops',
    label: 'Laptops',
  },
  {
    id: 'towers',
    label: 'Computer Towers',
  },
  {
    id: 'shapes',
    label: 'Basic Shapes',
  },
  {
    id: 'chairs',
    label: 'Chairs',
  },
  {
    id: 'miscellaneous',
    label: 'Miscellaneous',
  },
];

export const cards = [
  {
    id: 'appleStudioDisplay',
    product: 'appleStudioDisplay',
    category: 'monitors',
    name: 'Apple Studio Display',
    thumbnail: 'Model thumbnails/apple_studio_display.jpg',
    description: '27" display',
    desk: false,
  },
  {
    id: 'benqScreenBarHalo',
    product: 'benqScreenBarHalo',
    category: 'miscellaneous',
    name: 'BenQ ScreenBar Halo',
    thumbnail: 'Model thumbnails/benq_screenbar_halo.jpg',
    description: 'Monitor light bar · Move to align with your display',
    desk: false,
  },
  {
    id: 'macStudio',
    product: 'macStudio',
    category: 'towers',
    name: 'Mac Studio',
    thumbnail: 'Model thumbnails/mac_studio.jpg',
    description: 'Compact desktop computer',
    desk: false,
  },
  {
    id: 'appleStudioPro',
    product: 'appleStudioPro',
    category: 'monitors',
    name: 'Apple Pro Display XDR',
    thumbnail: 'Model thumbnails/apple_pro_display_xdr.jpg',
    description: '32" display',
    desk: false,
  },
  {
    id: 'customDesk',
    product: 'customDesk',
    category: 'desks',
    name: 'Custom Desk',
    thumbnail: 'Model thumbnails/customDeskLightAlderwood.jpg',
    select: {
      id: 'customDeskForm',
      label: 'Material',
      options: [
        {
          value: 'lightAlderwood',
          label: 'Light Alderwood',
          image: 'Model thumbnails/customDeskLightAlderwood.jpg',
        },
        {
          value: 'darkWalnut',
          label: 'Dark Walnut',
          image: 'Model thumbnails/customDeskDarkWalnut.jpg',
        },
        {
          value: 'italianOak',
          label: 'Italian Oak',
          image: 'Model thumbnails/customDeskItalianOak.jpg',
        },
        {
          value: 'zebranoWood',
          label: 'Zebrano Wood',
          image: 'Model thumbnails/customDeskZebranoWood.jpg',
        },
      ],
    },
    fields: [
      {
        id: 'customDeskW',
        label: 'Length',
        value: '1',
      },
      {
        id: 'customDeskL',
        label: 'Width',
        value: '1',
      },
    ],
    desk: true,
  },
  {
    id: 'modernDesk',
    product: 'modernDesk',
    category: 'desks',
    name: 'Modern Desk',
    thumbnail: 'Model thumbnails/standing desk 1.jpg',
    description: '23.8" L x 51.7" W x 30.3" H',
    desk: true,
  },
  {
    id: 'standingDesk',
    product: 'standingDesk',
    category: 'desks',
    name: 'Standing Desk',
    thumbnail: 'Model thumbnails/standing desk 2.jpg',
    description: '28.4" L x 55" W x 29.7" H',
    desk: true,
  },
  {
    id: 'linnmonDesk',
    family: 'linnmonDesk',
    category: 'desks',
    name: 'Linnmon Desk',
    thumbnail: 'Model thumbnails/linnmon desk.jpg',
    select: {
      id: 'linnmonDeskForm',
      label: 'Size (inches)',
      options: [
        {
          value: '39',
          label: '24" L x 39" W x 30.3" H',
        },
        {
          value: '47',
          label: '24" L x 47" W x 30.3" H',
        },
        {
          value: '59',
          label: '24" L x 59" W x 30.3" H',
        },
      ],
    },
    desk: true,
  },
  {
    id: 'alexDesk',
    family: 'alexDesk',
    category: 'desks',
    name: 'Alex Desk',
    thumbnail: 'Model thumbnails/alex desk.jpg',
    select: {
      id: 'alexDeskForm',
      label: 'Size (inches)',
      options: [
        {
          value: '61',
          label: '40" L x 61" W x 28.7" H',
        },
        {
          value: '67',
          label: '31" L x 67" W x 28.7" H',
        },
        {
          value: '79',
          label: '24" L x 79" W x 28.7" H',
        },
      ],
    },
    desk: true,
  },
  {
    id: 'bekantLShaped',
    family: 'bekantLShaped',
    category: 'desks',
    name: 'Bekant L Shaped Desk',
    thumbnail: 'Model thumbnails/L shaped desk.jpg',
    select: {
      id: 'bekantLShapedForm',
      label: 'Orientation',
      options: [
        {
          value: 'Left',
          label: 'Left',
        },
        {
          value: 'Right',
          label: 'Right',
        },
      ],
    },
    desk: true,
    description: '43.2" L x 63" W x 30.1" H',
  },
  {
    id: 'small16x9Monitor',
    family: 'small16x9Monitor',
    category: 'monitors',
    name: '16:9 Monitor',
    thumbnail: 'Model thumbnails/16_9 monitor 3.jpg',
    select: {
      id: 'small16x9MonitorForm',
      label: 'Size (inches)',
      options: [
        {
          value: '22',
          label: '22"',
        },
        {
          value: '23',
          label: '23"',
        },
        {
          value: '24',
          label: '24"',
        },
        {
          value: '25',
          label: '25"',
        },
        {
          value: '27',
          label: '27"',
        },
        {
          value: '28',
          label: '28"',
        },
        {
          value: '31',
          label: '31.5"',
        },
      ],
    },
    stand: true,
    desk: false,
  },
  {
    id: 'largeCurved16x9Monitor',
    family: 'largeCurved16x9Monitor',
    category: 'monitors',
    name: '16:9 Curved Monitor',
    thumbnail: 'Model thumbnails/curved large 16 9 monitor.jpg',
    select: {
      id: 'largeCurved16x9MonitorForm',
      label: 'Size (inches)',
      options: [
        {
          value: '25',
          label: '25"',
        },
        {
          value: '27',
          label: '27"',
        },
        {
          value: '31',
          label: '31.5"',
        },
        {
          value: '34',
          label: '34"',
        },
      ],
    },
    stand: true,
    desk: false,
  },
  {
    id: 'flat21x9Monitor',
    family: 'flat21x9Monitor',
    category: 'monitors',
    name: '21:9 Monitor',
    thumbnail: 'Model thumbnails/21 9 monitor 2 non curved.jpg',
    select: {
      id: 'flat21x9MonitorForm',
      label: 'Size (inches)',
      options: [
        {
          value: '25',
          label: '25"',
        },
        {
          value: '29',
          label: '29"',
        },
        {
          value: '34',
          label: '34"',
        },
      ],
    },
    stand: true,
    desk: false,
  },
  {
    id: 'curved21x9Monitor',
    family: 'curved21x9Monitor',
    category: 'monitors',
    name: '21:9 Curved Monitor',
    thumbnail: 'Model thumbnails/Ultrwide Monitor 1.jpg',
    select: {
      id: 'curved21x9MonitorForm',
      label: 'Size (inches)',
      options: [
        {
          value: '30',
          label: '30"',
        },
        {
          value: '34',
          label: '34"',
        },
        {
          value: '38',
          label: '38"',
        },
      ],
    },
    stand: true,
    desk: false,
  },
  {
    id: 'curved32x9Monitor',
    family: 'curved32x9Monitor',
    category: 'monitors',
    name: '32:9 Curved Monitor',
    thumbnail: 'Model thumbnails/32_9 monitor.jpg',
    select: {
      id: 'curved32x9MonitorForm',
      label: 'Size (inches)',
      options: [
        {
          value: '43',
          label: '43.4"',
        },
        {
          value: '49',
          label: '49"',
        },
      ],
    },
    stand: true,
    desk: false,
  },
  {
    id: 'default60PercentKeyboard',
    family: 'default60PercentKeyboard',
    category: 'keyboards',
    name: '60% Keyboard',
    thumbnail: 'Model thumbnails/default60PercentKeyboardAllGrey.jpg',
    description: '4.3" L x 12" W x 1.4" H',
    select: {
      id: 'default60PercentKeyboardForm',
      label: 'Style',
      options: [
        {
          value: 'AllGrey',
          label: 'All Grey',
        },
        {
          value: 'AllWhite',
          label: 'All White',
        },
        {
          value: 'Minimalist',
          label: 'Minimalist',
        },
        {
          value: 'Nightrunner',
          label: 'Nightrunner',
        },
        {
          value: 'WGR',
          label: 'White / Grey / Red',
        },
        {
          value: 'OBW',
          label: 'Orange / Black / White',
        },
        {
          value: 'YPGrad',
          label: 'Sunset',
        },
      ],
    },
    desk: false,
  },
  {
    id: '75PercentKeyboard',
    family: '75PercentKeyboard',
    category: 'keyboards',
    name: '75% Keyboard',
    thumbnail: 'Model thumbnails/75PercentKeyboardAllGrey.jpg',
    description: '4.3" L x 12.5" W x 1.4" H',
    select: {
      id: '75PercentKeyboardForm',
      label: 'Style',
      options: [
        {
          value: 'AllGrey',
          label: 'All Grey',
        },
        {
          value: 'AllWhite',
          label: 'All White',
        },
        {
          value: 'Minimalist',
          label: 'Minimalist',
        },
        {
          value: 'Nightrunner',
          label: 'Nightrunner',
        },
        {
          value: 'WGR',
          label: 'White / Grey / Red',
        },
        {
          value: 'OBW',
          label: 'Orange / Black / White',
        },
        {
          value: '8008',
          label: '8008',
        },
      ],
    },
    desk: false,
  },
  {
    id: 'defaultFullKeyboard',
    family: 'defaultFullKeyboard',
    category: 'keyboards',
    name: 'Full Size Keyboard',
    thumbnail: 'Model thumbnails/defaultFullKeyboardAllGrey.jpg',
    description: '5.5" L x 18" W x 1.5" H',
    select: {
      id: 'defaultFullKeyboardForm',
      label: 'Style',
      options: [
        {
          value: 'AllGrey',
          label: 'All Grey',
        },
        {
          value: 'AllWhite',
          label: 'All White',
        },
        {
          value: 'Nightrunner',
          label: 'Nightrunner',
        },
        {
          value: 'WGR',
          label: 'White / Grey / Red',
        },
        {
          value: 'OBW',
          label: 'Orange / Black / White',
        },
        {
          value: 'YPGrade',
          label: 'Sunset',
        },
      ],
    },
    desk: false,
  },
  {
    id: 'TKLKeyboard',
    family: 'TKLKeyboard',
    category: 'keyboards',
    name: 'TKL Keyboard',
    thumbnail: 'Model thumbnails/TKLKeyboardAllGrey.jpg',
    description: '5.6" L x 14.8" W x 1.5" H',
    select: {
      id: 'TKLKeyboardForm',
      label: 'Style',
      options: [
        {
          value: 'AllGrey',
          label: 'All Grey',
        },
        {
          value: 'AllWhite',
          label: 'All White',
        },
        {
          value: 'WGR',
          label: 'White / Grey / Red',
        },
        {
          value: 'OBW',
          label: 'Orange / Black / White',
        },
        {
          value: 'YPGrade',
          label: 'Sunset',
        },
        {
          value: '8008',
          label: '8008',
        },
      ],
    },
    desk: false,
  },
  {
    id: 'MXMaster3',
    product: 'MXMaster3',
    category: 'mice',
    name: 'MX Master Mouse',
    thumbnail: 'Model thumbnails/mouse 2.jpg',
    description: '4.9" L x 43.5" W x 2" H',
    desk: false,
  },
  {
    id: 'defaultMouse',
    product: 'defaultMouse',
    category: 'mice',
    name: 'DeathAdder Mouse',
    thumbnail: 'Model thumbnails/Mouse 1 textured.jpg',
    description: '4.1" L x 2.2" W x 1.6" H',
    desk: false,
  },
  {
    id: 'QCKSmall',
    product: 'QCKSmall',
    category: 'mousepads',
    name: 'QCK Small',
    thumbnail: 'Model thumbnails/small qck mousepad.jpg',
    description: '8.4" L x 9.8" W',
    desk: false,
  },
  {
    id: 'QCKMedium',
    product: 'QCKMedium',
    category: 'mousepads',
    name: 'QCK Medium',
    thumbnail: 'Model thumbnails/medium qck mousepad.jpg',
    description: '10.6" L x 12.6" W',
    desk: false,
  },
  {
    id: 'QCKLarge',
    product: 'QCKLarge',
    category: 'mousepads',
    name: 'QCK Large',
    thumbnail: 'Model thumbnails/large qck mousepad.jpg',
    description: '15.7" L x 17.7" W',
    desk: false,
  },
  {
    id: 'QCKXXL',
    product: 'QCKXXL',
    category: 'mousepads',
    name: 'QCK XXL',
    thumbnail: 'Model thumbnails/qck mousepad XXL.jpg',
    description: '35.4" L x 15.7" W',
    desk: false,
  },
  {
    id: 'deskSpacingSpeaker',
    family: 'deskSpacingSpeaker',
    category: 'audio',
    name: 'Wood Grain Monitor Speakers',
    thumbnail: 'Model thumbnails/speakers 1.jpg',
    description: '7.4" L x 5.8" W x 9.5" H',
    select: {
      id: 'deskSpacingSpeakerForm',
      label: 'Type',
      options: [
        {
          value: 'Primary',
          label: 'Primary',
        },
        {
          value: 'Secondary',
          label: 'Secondary',
        },
      ],
    },
    desk: false,
  },
  {
    id: 'deskSpacingSoundBar',
    product: 'deskSpacingSoundBar',
    category: 'audio',
    name: 'SoundBar',
    thumbnail: 'Model thumbnails/speaker bar 1.jpg',
    description: '2.5" L x 16" W x 2.8" H',
    desk: false,
  },
  {
    id: 'studioMonitorSpeaker',
    family: 'studioMonitorSpeaker',
    category: 'audio',
    name: 'Studio Monitor Speakers',
    thumbnail: 'Model thumbnails/speakers 2 primary.jpg',
    description: '8.3" L x 7.3" W x 10.3" H',
    select: {
      id: 'studioMonitorSpeakerForm',
      label: 'Type',
      options: [
        {
          value: 'Primary',
          label: 'Primary',
        },
        {
          value: 'Secondary',
          label: 'Secondary',
        },
      ],
    },
    desk: false,
  },
  {
    id: 'yetiUSBMic',
    product: 'yetiUSBMic',
    category: 'audio',
    name: 'USB Microphone',
    thumbnail: 'Model thumbnails/blue yeti.jpg',
    description: '4.8" L x 4.6" W x 11.6" H',
    desk: false,
  },
  {
    id: 'audioInterface',
    product: 'audioInterface',
    category: 'audio',
    name: 'Audio Interface',
    thumbnail: 'Model thumbnails/audio interface.jpg',
    description: '4.2" L x 5.7" W x 1.7" H',
    desk: false,
  },
  {
    id: 'MIDIKeyboard',
    product: 'MIDIKeyboard',
    category: 'audio',
    name: 'MIDI Keyboard',
    thumbnail: 'Model thumbnails/midi keyboard 1.jpg',
    description: '7.1" L x 12.5" W x 1.5" H',
    desk: false,
  },
  {
    id: 'modernLaptop13',
    product: 'modernLaptop13',
    category: 'laptops',
    name: '13" Laptop',
    thumbnail: 'Model thumbnails/13 inch laptop.jpg',
    desk: false,
  },
  {
    id: 'modernLaptop15',
    product: 'modernLaptop15',
    category: 'laptops',
    name: '15" Laptop',
    thumbnail: 'Model thumbnails/15 inch laptop.jpg',
    desk: false,
  },
  {
    id: 'modernLaptop17',
    product: 'modernLaptop17',
    category: 'laptops',
    name: '17" Laptop',
    thumbnail: 'Model thumbnails/17 inch laptop.jpg',
    desk: false,
  },
  {
    id: 'modernComputerTower',
    product: 'modernComputerTower',
    category: 'towers',
    name: 'Desktop Computer',
    thumbnail: 'Model thumbnails/desktop 1.jpg',
    description: '8.3" L x 16.5" W x 19.5" H',
    desk: false,
  },
  {
    id: 'miniITXTower',
    product: 'miniITXTower',
    category: 'towers',
    name: 'Modern Mini ITX Computer Build',
    thumbnail: 'Model thumbnails/desktop 2 small.jpg',
    description: '16.7" L x 13.6" W x 14.3" H',
    desk: false,
  },
  {
    id: 'referenceBox',
    product: 'referenceBox',
    category: 'shapes',
    name: 'Box',
    thumbnail: 'Model thumbnails/cube primitive.jpg',
    fields: [
      {
        id: 'referenceBoxH',
        label: 'Length',
        value: '1',
      },
      {
        id: 'referenceBoxL',
        label: 'Width',
        value: '1',
      },
      {
        id: 'referenceBoxW',
        label: 'Height',
        value: '1',
      },
    ],
    desk: false,
  },
  {
    id: 'referenceSphere',
    product: 'referenceSphere',
    category: 'shapes',
    name: 'Sphere',
    thumbnail: 'Model thumbnails/primitive sphere.jpg',
    fields: [
      {
        id: 'referenceSphereRadius',
        label: 'Radius',
        value: '1',
      },
    ],
    desk: false,
  },
  {
    id: 'modernOfficeChair',
    product: 'modernOfficeChair',
    category: 'chairs',
    name: 'Modern Office Chair',
    thumbnail: 'Model thumbnails/office chair.jpg',
    desk: false,
  },
  {
    id: 'simpleChair',
    product: 'simpleChair',
    category: 'chairs',
    name: 'Simple Chair',
    thumbnail: 'Model thumbnails/simple chair.jpg',
    desk: false,
  },
  {
    id: 'gamingChair',
    product: 'gamingChair',
    category: 'chairs',
    name: 'Gaming Chair',
    thumbnail: 'Model thumbnails/gaming chair.jpg',
    desk: false,
  },
  {
    id: 'regularBook',
    product: 'regularBook',
    category: 'miscellaneous',
    name: 'Book',
    thumbnail: 'Model thumbnails/book.jpg',
    desk: false,
  },
  {
    id: 'coffeeCup',
    product: 'coffeeCup',
    category: 'miscellaneous',
    name: 'Coffee Cup',
    thumbnail: 'Model thumbnails/coffee cup.jpg',
    desk: false,
  },
  {
    id: 'basicLamp',
    product: 'basicLamp',
    category: 'miscellaneous',
    name: 'Basic Lamp',
    thumbnail: 'Model thumbnails/lamp 1.jpg',
    description: '8" L x 5" W x 9.7" H',
    desk: false,
  },
  {
    id: 'modernLamp',
    product: 'modernLamp',
    category: 'miscellaneous',
    name: 'Modern Lamp',
    thumbnail: 'Model thumbnails/lamp 2.jpg',
    description: '10.2" L x 4" W x 8.3" H',
    desk: false,
  },
];

export function describeProduct(product) {
  for (const card of cards) {
    if (card.product === product) return { ...card, variation: '' };
    if (!card.family) continue;
    for (const option of card.select.options) {
      for (const noStand of card.stand ? [false, true] : [false]) {
        if (resolveProduct(card.family, option.value, noStand) !== product)
          continue;
        return {
          ...card,
          variation: `${option.label}${noStand ? ' · No stand' : ''}`,
          thumbnail: families[card.family].preview
            ? `Model thumbnails/${card.family}${option.value}.jpg`
            : card.thumbnail,
        };
      }
    }
  }
  const compatibilityNames = {
    drawerDesk: 'Drawer Desk',
    TKLKeyboardYGB: 'TKL Keyboard · Yellow / Grey / Blue',
    mediumRGBMousepad: 'Medium RGB Mousepad',
    floor: 'Floor',
  };
  return {
    name: compatibilityNames[product] || product || 'Object',
    variation: '',
  };
}
