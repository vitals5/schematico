import { getUiLanguage, Language } from './index';
import type { SymbolDefinition } from '../model/types';

export const CATEGORY_TRANSLATIONS: Record<string, { de: string; en: string }> = {
  all: { de: 'Alle Kategorien', en: 'All Categories' },
  project: { de: 'Projektbibliothek (mitgeliefert)', en: 'Project Library (bundled)' },
  protection: { de: 'Schutzgeräte', en: 'Protection Devices' },
  relays: { de: 'Schaltgeräte & Relais', en: 'Switchgear & Relays' },
  terminals: { de: 'Klemmen & Verbindungstechnik', en: 'Terminals & Wiring' },
  supply: { de: 'Versorgung & Messtechnik', en: 'Power Supply & Measurement' },
  controls: { de: 'Befehls- & Meldegeräte', en: 'Control & Signaling Devices' },
  sensors: { de: 'Sensorik', en: 'Sensors' },
  automation: { de: 'Steuerung & Kommunikation', en: 'Control Systems & PLC' },
  motors: { de: 'Antriebe & Leistungselektronik', en: 'Drives & Power Electronics' },
  installation: { de: 'Gebäudetechnik & Installation', en: 'Building Installation' },
  structure: { de: 'Schrankbau & Struktur', en: 'Cabinet & Structure' }
};

export const CONNECTION_CATEGORY_TRANSLATIONS: Record<string, { de: string; en: string }> = {
  all: { de: 'Alle Verbindungselemente', en: 'All Connection Elements' },
  interruptions: { de: 'Abbruchstellen', en: 'Interruption Points' },
  tees: { de: 'T-Stücke', en: 'T-Junctions' },
  corners: { de: 'Winkel', en: 'Corners' },
  crossings: { de: 'Kreuzungen', en: 'Crossings' },
  other: { de: 'Weitere', en: 'Other' },
  project: { de: 'Projektbibliothek', en: 'Project Library' }
};

export const MACRO_CATEGORY_TRANSLATIONS: Record<string, { de: string; en: string }> = {
  all: { de: 'Alle Makros', en: 'All Macros' },
  window: { de: '📦 Fenstermakros (.ema)', en: '📦 Window Macros (.ema)' },
  page: { de: '📦 Makros (.ems)', en: '📦 Page Macros (.ems)' },
  motor: { de: '⚙️ Motoren & Antriebe', en: '⚙️ Motors & Drives' },
  power: { de: '⚡ Stromversorgung', en: '⚡ Power Supply' },
  safety: { de: '🛡️ Not-Halt & Sicherheit', en: '🛡️ Safety & E-Stop' },
  external: { de: '📁 Externer Ordner', en: '📁 External Folder' },
  user: { de: '⭐ Eigene Importe', en: '⭐ User Imports' }
};

export function getCategoryLabel(categoryId: string, lang: Language = getUiLanguage()): string {
  const trans = CATEGORY_TRANSLATIONS[categoryId];
  return trans ? trans[lang] : categoryId;
}

export function getConnectionCategoryLabel(categoryId: string, lang: Language = getUiLanguage()): string {
  const trans = CONNECTION_CATEGORY_TRANSLATIONS[categoryId];
  return trans ? trans[lang] : categoryId;
}

export function getMacroCategoryLabel(categoryId: string, lang: Language = getUiLanguage()): string {
  const trans = MACRO_CATEGORY_TRANSLATIONS[categoryId];
  return trans ? trans[lang] : categoryId;
}

export const SYMBOL_EXACT_TRANSLATIONS: Record<string, { name: string; description?: string }> = {
  coil: { name: 'Contactor Coil', description: 'Coil for contactor or relay' },
  no_contact: { name: 'NO Contact (Auxiliary)', description: 'Normally open auxiliary contact' },
  nc_contact: { name: 'NC Contact (Auxiliary)', description: 'Normally closed auxiliary contact' },
  power_contacts_3p: { name: 'Power Contacts (3-Pole)', description: 'Main switching contacts for 3-pole contactor' },
  motor_breaker_3p: { name: 'Motor Circuit Breaker (3-Pole)', description: 'Motor protection switch with thermal and magnetic trip' },
  fuse_1p: { name: 'Fuse (1-Pole)', description: 'Overcurrent protection fuse 1-pole' },
  pushbutton_no: { name: 'Pushbutton (NO)', description: 'Momentary pushbutton with normally open contact' },
  emergency_stop_nc: { name: 'Emergency Stop Pushbutton (NC)', description: 'Latching emergency stop pushbutton with NC contact' },
  indicator_light: { name: 'Indicator Lamp', description: 'Optical signal light / indicator lamp' },
  motor_3phase: { name: 'Three-Phase Motor (3~)', description: 'Asynchronous squirrel-cage three-phase AC motor' },
  terminal: { name: 'Terminal Block', description: 'Pass-through DIN-rail terminal block' },
  terminal_pe: { name: 'Ground Terminal (PE)', description: 'Protective earth (PE) ground terminal block' },
  ground_pe: { name: 'Ground / Earth (PE)', description: 'Protective earth / chassis ground connection' },
  power_supply_24v: { name: 'Power Supply 24V DC', description: 'Switching power supply 230V AC to 24V DC' },
  potential_arrow: { name: 'Interruption Point (Arrow)', description: 'Interruption point for sheet cross-reference' },
  potential_arrow_right: { name: 'Interruption Point / Arrow Right', description: 'Interruption point / potential arrow pointing right' },
  potential_arrow_left: { name: 'Interruption Point / Arrow Left', description: 'Interruption point / potential arrow pointing left' },
  potential_arrow_down: { name: 'Interruption Point / Arrow Down', description: 'Interruption point / potential arrow pointing down' },
  potential_arrow_up: { name: 'Interruption Point / Arrow Up', description: 'Interruption point / potential arrow pointing up' },
  rccb_4p: { name: 'RCD / RCCB Breaker (4-Pole)', description: 'Residual current circuit breaker 4-pole' },
  rccb_2p: { name: 'RCD / RCCB Breaker (2-Pole)', description: 'Residual current circuit breaker 2-pole' },
  rcbo_1pn: { name: 'RCBO Breaker (1P+N)', description: 'Combined residual current and miniature circuit breaker 1P+N' },
  latching_relay_1no: { name: 'Latching Relay (1 NO)', description: 'Impulse / latching relay 1 normally open contact' },
  time_relay_on: { name: 'Time Relay On-Delay (1 CO)', description: 'On-delay timer relay 1 changeover contact' },
  time_relay_off: { name: 'Time Relay Off-Delay (1 CO)', description: 'Off-delay timer relay 1 changeover contact' },
  mcb_1p: { name: 'Circuit Breaker MCB (1-Pole)', description: 'Miniature circuit breaker 1-pole' },
  mcb_3p: { name: 'Circuit Breaker MCB (3-Pole)', description: 'Miniature circuit breaker 3-pole' },
  mcb_3pn: { name: 'Circuit Breaker MCB (3P+N)', description: 'Miniature circuit breaker 3P+N' },
  transformer_single: { name: 'Single-Phase Transformer', description: 'Control transformer 230V/24V AC' },
  plc_di_4: { name: 'PLC Digital Input (4 Channels)', description: 'PLC digital input module 24V DC 4 channels' },
  plc_do_4: { name: 'PLC Digital Output (4 Channels)', description: 'PLC digital output module 24V DC 4 channels' },
  frequency_inverter: { name: 'Frequency Inverter (VFD)', description: 'Variable frequency drive for speed control' },
  soft_starter: { name: 'Soft Starter', description: 'Electronic soft starter for 3-phase motors' },
  proximity_switch_pnp: { name: 'Proximity Sensor (PNP-NO)', description: 'Inductive sensor PNP normally open' },
  photoelectric_sensor: { name: 'Photoelectric Sensor', description: 'Optical through-beam or retroreflective sensor' },
  t_piece_down: { name: 'T-Junction (Branch Down)', description: 'Horizontal tee with branch pointing down' },
  t_piece_up: { name: 'T-Junction (Branch Up)', description: 'Horizontal tee with branch pointing up' },
  t_piece_right: { name: 'T-Junction (Branch Right)', description: 'Vertical tee with branch pointing right' },
  t_piece_left: { name: 'T-Junction (Branch Left)', description: 'Vertical tee with branch pointing left' },
  corner_top_right: { name: 'Corner (Left-Down)', description: 'Corner connector from left to bottom' },
  corner_top_left: { name: 'Corner (Right-Down)', description: 'Corner connector from right to bottom' },
  corner_bottom_right: { name: 'Corner (Left-Up)', description: 'Corner connector from left to top' },
  corner_bottom_left: { name: 'Corner (Right-Up)', description: 'Corner connector from right to top' },
  cross_junction: { name: 'Crossing with Junction Point', description: 'Electrical 4-way connection with node' },
  cross_bridge: { name: 'Crossing without Connection (Bridge)', description: 'Wire crossing without electrical contact' },
  potential_rail_source: { name: 'Potential Infeed Point', description: 'Busbar or potential infeed connection' },
  rj45_port: { name: 'RJ45 Network Port', description: 'RJ45 Ethernet connector socket' },
  overload_relay_3p: { name: 'Thermal Overload Relay (3-Pole)', description: 'Bimetallic thermal motor overload relay' },
  main_switch_3p: { name: 'Main Switch (3-Pole)', description: 'Rotary main disconnect switch 3-pole' },
  main_switch_4p: { name: 'Main Switch / Disconnector (4-Pole)', description: 'Rotary main switch and load disconnector 4-pole' },
  energy_meter_3p: { name: 'Three-Phase Energy Meter', description: 'Electronic kWh energy meter' },
  motor_1phase: { name: 'Single-Phase AC Motor (1~)', description: 'Single-phase AC motor with capacitor' },
  socket_schuko: { name: 'Power Socket (Schuko)', description: 'AC power outlet with protective earth' },
  switch_socket: { name: 'Switch Socket Combination', description: 'Light switch and outlet combo unit' },
  lamp: { name: 'Light / Lamp', description: 'General luminaire or lighting fixture' },
  actuator_thermal: { name: 'Thermoelectric Actuator', description: 'Electrothermal valve actuator 230V/24V' },
  thermostat: { name: 'Room Thermostat', description: 'Electronic room temperature controller' },
  pv_inverter: { name: 'PV Hybrid Inverter & Storage', description: 'Photovoltaic hybrid inverter with battery system' },
  relay_4channel: { name: 'Electronic 4-Channel Latching Relay', description: 'Electronic impulse switching actuator 4 channels' },
  switch_1p: { name: 'Switch / Pushbutton (1-Pole)', description: 'Single-pole light switch or pushbutton' },
  device_box: { name: 'Device Box', description: 'Device enclosure / location box' },
  // Standard IEC 60617 Symbols
  resistor: { name: 'Resistor', description: 'Fixed resistor (IEC 60617)' },
  potentiometer: { name: 'Potentiometer', description: 'Adjustable resistor / potentiometer with wiper' },
  varistor: { name: 'Varistor (VDR)', description: 'Voltage-dependent resistor (VDR) for surge protection' },
  heating_element: { name: 'Heating Element', description: 'Electrical heating resistor / heating element' },
  capacitor: { name: 'Capacitor', description: 'Fixed capacitor (IEC 60617)' },
  capacitor_polarized: { name: 'Polarized Capacitor', description: 'Electrolytic capacitor (polarized)' },
  inductor_choke: { name: 'Inductor / Choke', description: 'Inductor / coil / choke (IEC 60617)' },
  diode: { name: 'Diode', description: 'Semiconductor diode (IEC 60617)' },
  zener_diode: { name: 'Zener Diode', description: 'Voltage regulator / Zener breakdown diode' },
  diode_led: { name: 'Light Emitting Diode (LED)', description: 'Optical light emitting diode (LED)' },
  photodiode: { name: 'Photodiode', description: 'Light-sensitive photodiode (IEC 60617)' },
  thyristor: { name: 'Thyristor (SCR)', description: 'Reverse blocking triode thyristor (SCR)' },
  triac: { name: 'Triac', description: 'Bidirectional triode thyristor (Triac)' },
  transistor_npn: { name: 'NPN Transistor', description: 'Bipolar junction transistor (NPN)' },
  transistor_pnp: { name: 'PNP Transistor', description: 'Bipolar junction transistor (PNP)' },
  mosfet_n: { name: 'N-Channel MOSFET', description: 'N-channel enhancement-mode MOSFET' },
  igbt_n: { name: 'N-Channel IGBT', description: 'Insulated gate bipolar transistor (IGBT)' },
  transformer_1p: { name: 'Single-Phase Transformer', description: 'Two-winding single-phase transformer' },
  auto_transformer: { name: 'Auto-Transformer', description: 'Single-phase auto-transformer with tap' },
  current_transformer_1p: { name: 'Current Transformer (1-Pole)', description: 'Single-phase current transformer (CT)' },
  voltage_transformer_1p: { name: 'Voltage Transformer (1-Pole)', description: 'Inductive voltage transformer (VT / PT)' },
  transformer_3phase: { name: 'Three-Phase Transformer (Yd)', description: 'Three-phase transformer star-delta connection' },
  rectifier_bridge: { name: 'Bridge Rectifier', description: 'Full-wave bridge rectifier (Graetz)' },
  dcdc_converter: { name: 'DC/DC Converter', description: 'Direct current converter / chopper' },
  power_inverter: { name: 'Inverter (DC/AC)', description: 'DC to AC power inverter' },
  battery_cell: { name: 'Battery / Accumulator', description: 'Primary cell or battery accumulator' },
  voltmeter: { name: 'Voltmeter', description: 'Indicating voltage meter (Voltmeter)' },
  ammeter: { name: 'Ammeter', description: 'Indicating current meter (Ammeter)' },
  wattmeter: { name: 'Wattmeter', description: 'Active power meter (Wattmeter)' },
  frequency_meter: { name: 'Frequency Meter', description: 'Frequency meter (Hz)' },
  energy_meter_1p: { name: 'Single-Phase Energy Meter', description: 'Single-phase watt-hour energy meter (kWh)' },
  thermocouple: { name: 'Thermocouple', description: 'Thermocouple temperature sensor (IEC 60617)' },
  buzzer: { name: 'Buzzer', description: 'Acoustic buzzer signaling device' },
  siren: { name: 'Siren', description: 'Acoustic alarm siren' },
  horn_acoustic: { name: 'Horn / Klaxon', description: 'Acoustic signal horn' },
  bell_acoustic: { name: 'Electric Bell', description: 'Electric bell / ringer signaling device' },
  contact_changeover: { name: 'Changeover Contact', description: 'Auxiliary changeover contact (SPDT)' },
  contact_delayed_on_no: { name: 'Delayed NO Contact (ON-Delay)', description: 'Normally open contact with time delay on energization' },
  contact_delayed_off_nc: { name: 'Delayed NC Contact (OFF-Delay)', description: 'Normally closed contact with time delay on de-energization' },
  limit_switch_no: { name: 'Limit Switch (NO)', description: 'Mechanical position limit switch normally open' },
  limit_switch_nc: { name: 'Limit Switch (NC)', description: 'Mechanical position limit switch normally closed' },
  bimetal_switch_nc: { name: 'Thermal Bimetal Switch (NC)', description: 'Temperature-sensitive bimetal switch normally closed' },
  selector_switch_2pos: { name: 'Selector Switch (2-Position 0-1)', description: 'Rotary selector switch 2 positions' },
  selector_switch_3pos: { name: 'Selector Switch (3-Position 1-0-2)', description: 'Rotary selector switch Hand-0-Auto 3 positions' },
  disconnector_1p: { name: 'Disconnector (1-Pole)', description: 'Single-pole isolating disconnector switch' },
  disconnector_3p: { name: 'Switch Disconnector (3-Pole)', description: 'Three-pole on-load switch disconnector' },
  earth_ground: { name: 'Earth Ground', description: 'General earth ground symbol (IEC 60617)' },
  frame_ground: { name: 'Chassis / Frame Ground', description: 'Chassis or frame connection (IEC 60617)' },
  equipotential_bonding: { name: 'Equipotential Bonding', description: 'Functional and protective equipotential bonding' },
  plug_male: { name: 'Male Connector (Pin)', description: 'Male pin connector contact (IEC 60617)' },
  socket_female: { name: 'Female Connector (Receptacle)', description: 'Female socket receptacle contact (IEC 60617)' },
  plug_socket_pair: { name: 'Plug & Socket Connector', description: 'Separable plug and socket connector pair' },
  motor_dc: { name: 'DC Motor', description: 'Direct current electric motor with brushes' },
  generator_dc: { name: 'DC Generator', description: 'Direct current electric generator' },
  generator_3phase: { name: 'Three-Phase Generator (3~)', description: 'Three-phase synchronous generator' },
  usb_socket_type_a: { name: 'USB Socket (Type A, 4-Pin)', description: 'USB Type-A 4-pin socket with shield' },
  usb_socket_type_c: { name: 'USB-C Socket (Type C)', description: 'USB Type-C reversible interface connector' },
  usb_socket_double: { name: 'Dual USB Socket (2x Type A)', description: 'Dual USB-A socket connector for panel mounting' },
  usb_service_socket: { name: 'USB Service Interface', description: 'Cabinet bulkhead / front USB service port' },
  rj45_socket_8p: { name: 'RJ45 Socket (8-Pin, Cat.6)', description: 'RJ45 8-pin Ethernet connector socket Cat.6 with shield' },
  rj45_socket_4p: { name: 'RJ45 Socket (4-Pin, PROFINET)', description: 'RJ45 4-pin Industrial Ethernet / PROFINET socket' },
  rj45_feedthrough: { name: 'RJ45 Panel Feedthrough', description: 'RJ45 bulkhead coupler / feedthrough jack' }
};

const PHRASE_REPLACEMENTS: [RegExp, string][] = [
  [/Leitungsschutzschalter LS \/ MCB/g, 'Miniature Circuit Breaker MCB'],
  [/Fehlerstrom-Schutzschalter FI \/ RCD/g, 'Residual Current Device RCD'],
  [/FI\/LS-Kombischalter RCBO/g, 'RCBO Circuit Breaker'],
  [/Brandschutzschalter/g, 'Arc Fault Detection Device (AFDD)'],
  [/Motorschutzschalter MSS \/ MPCB/g, 'Motor Circuit Breaker MPCB'],
  [/Motorschutzschalter/g, 'Motor Circuit Breaker'],
  [/Schmelzsicherung Neozed/g, 'Cartridge Fuse Neozed'],
  [/Schmelzsicherung Diazed/g, 'Cartridge Fuse Diazed'],
  [/NH-Sicherungs-Lasttrenner/g, 'NH Fuse Switch Disconnector'],
  [/NH-Schmelzsicherung/g, 'NH Blade Fuse'],
  [/Feinsicherung/g, 'Miniature Glass Fuse'],
  [/PV-Zylindersicherung/g, 'PV Cylindrical Fuse'],
  [/Überspannungsschutz SPD/g, 'Surge Protection Device SPD'],
  [/Kompaktleistungsschalter/g, 'Molded Case Circuit Breaker (MCCB)'],
  [/Offener Leistungsschalter/g, 'Air Circuit Breaker (ACB)'],
  [/Leistungsschalter/g, 'Circuit Breaker'],
  [/Leistungsschütz/g, 'Power Contactor'],
  [/Stern-Dreieck-Schützkombination/g, 'Star-Delta Contactor Assembly'],
  [/Wendeschützkombination/g, 'Reversing Contactor Assembly'],
  [/Koppelrelais/g, 'Coupling Relay'],
  [/Miniaturrelais/g, 'Miniature Relay'],
  [/Printrelais/g, 'PCB Relay'],
  [/Stromstoßrelais/g, 'Latching / Impulse Relay'],
  [/Zeitrelais ansprechverzögert/g, 'Timer Relay (On-Delay)'],
  [/Zeitrelais rückfallverzögert/g, 'Timer Relay (Off-Delay)'],
  [/Zeitrelais/g, 'Timer Relay'],
  [/Schützspule/g, 'Contactor Coil'],
  [/Schließer \(Hilfskontakt\)/g, 'NO Contact (Auxiliary)'],
  [/Öffner \(Hilfskontakt\)/g, 'NC Contact (Auxiliary)'],
  [/Leistungsschaltglieder/g, 'Power Contacts'],
  [/Wechsler/g, 'CO Contact'],
  [/Schließer/g, 'Normally Open (NO)'],
  [/Öffner/g, 'Normally Closed (NC)'],
  [/Taster/g, 'Pushbutton'],
  [/Not-Halt-Taster/g, 'Emergency Stop Pushbutton'],
  [/Not-Halt/g, 'Emergency Stop'],
  [/Meldeleuchte/g, 'Indicator Lamp'],
  [/Drehstrommotor/g, 'Three-Phase Motor'],
  [/Wechselstrommotor/g, 'Single-Phase AC Motor'],
  [/Reihenklemme/g, 'Terminal Block'],
  [/Schutzleiter-Klemme/g, 'Ground Terminal (PE)'],
  [/Erde \/ Schutzleiter/g, 'Ground / Earth (PE)'],
  [/Schaltnetzteil/g, 'Power Supply'],
  [/Transformator/g, 'Transformer'],
  [/Drehstromzähler/g, 'Three-Phase Energy Meter'],
  [/Schutzkontakt-Steckdose/g, 'Power Socket (Schuko)'],
  [/Schaltersteckdose/g, 'Switch Socket Combination'],
  [/Leuchte \/ Lampe/g, 'Light / Lamp'],
  [/Thermoelektrischer Stellantrieb/g, 'Thermoelectric Actuator'],
  [/Raumthermostat/g, 'Room Thermostat'],
  [/PV-Hybridwechselrichter/g, 'PV Hybrid Inverter'],
  [/Frequenzumrichter/g, 'Frequency Inverter (VFD)'],
  [/Sanftanlasser/g, 'Soft Starter'],
  [/Näherungsschalter/g, 'Proximity Sensor'],
  [/Lichtschranke/g, 'Photoelectric Sensor'],
  [/Abbruchstelle \/ Potentialpfeil/g, 'Interruption Point / Arrow'],
  [/Abbruchstelle \(Potenzialpfeil\)/g, 'Interruption Point (Arrow)'],
  [/Abbruchstelle/g, 'Interruption Point'],
  [/Potentialpfeil/g, 'Potential Arrow'],
  [/Potenzialpfeil/g, 'Potential Arrow'],
  [/Potentialeinspeisepunkt/g, 'Potential Infeed Point'],
  [/T-Stück/g, 'T-Junction'],
  [/Winkel \/ Ecke/g, 'Corner'],
  [/Kreuzung mit Verbindungspunkt/g, 'Crossing with Junction'],
  [/Kreuzung ohne Verbindung/g, 'Crossing without Connection'],
  [/Gerätekasten/g, 'Device Box'],
  [/3-polig/g, '3-Pole'],
  [/4-polig/g, '4-Pole'],
  [/2-polig/g, '2-Pole'],
  [/1-polig/g, '1-Pole'],
  [/rechts/g, 'right'],
  [/links/g, 'left'],
  [/oben/g, 'top'],
  [/unten/g, 'bottom']
];

export function translateSymbolText(text: string): string {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function getLocalizedSymbol(sym: SymbolDefinition, lang: Language = getUiLanguage()): { name: string; description: string } {
  if (lang === 'de') {
    return { name: sym.name, description: sym.description };
  }
  const exact = SYMBOL_EXACT_TRANSLATIONS[sym.id];
  if (exact) {
    return {
      name: exact.name,
      description: exact.description ?? exact.name
    };
  }
  return {
    name: translateSymbolText(sym.name),
    description: translateSymbolText(sym.description)
  };
}
