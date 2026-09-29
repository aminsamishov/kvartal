import type { AppUser, DocumentTemplate, PaymentMethod, Promotion, SalesOffice, TemplateVariable, UnitOption, UserRole } from '~/types/models'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  director: 'Директор',
  commercial_director: 'Коммерческий директор',
  finance_director: 'Финансовый директор',
  manager: 'Менеджер продаж',
  care_manager: 'Куратор ОРК',
  accountant: 'Бухгалтер',
  cashier: 'Кассир',
  head_cashier: 'Заведующий кассой',
  controller: 'Контролёр',
  lawyer: 'Юрист',
  partner: 'Компаньон',
  auditor: 'Аудитор',
  agent: 'Агент',
}

export const SALES_OFFICES: SalesOffice[] = [
  { id: 'office-1', name: 'Офис продаж «Центр»', address: 'пр. Чуй, 154', phone: '+996 312 900 100', projectIds: ['aurora', 'panorama'] },
  { id: 'office-2', name: 'Офис продаж на объекте «Аврора»', address: 'ул. Ахунбаева, 2/1', phone: '+996 312 900 101', projectIds: ['aurora'] },
]

export const USERS: AppUser[] = [
  { id: 'u-director', name: 'Тимур Асанов', role: 'director', email: 'asanov@inhouse.kg', phone: '996700100100', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#6E4453' },
  { id: 'u-comdir', name: 'Гульнара Молдалиева', role: 'commercial_director', email: 'moldalieva@inhouse.kg', phone: '996700100101', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#2F7D5C' },
  { id: 'u-findir', name: 'Игорь Кузнецов', role: 'finance_director', email: 'kuznetsov@inhouse.kg', phone: '996700100102', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#3A6EA5' },
  { id: 'u-mgr-1', name: 'Айгуль Осмонова', role: 'manager', email: 'osmonova@inhouse.kg', phone: '996700100110', projectIds: ['aurora'], active: true, avatarColor: '#B8780E' },
  { id: 'u-mgr-2', name: 'Данияр Токтогулов', role: 'manager', email: 'toktogulov@inhouse.kg', phone: '996700100111', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#A77886' },
  { id: 'u-mgr-3', name: 'Дана Абдыкадырова', role: 'manager', email: 'abdykadyrova@inhouse.kg', phone: '996700100112', projectIds: ['panorama'], active: true, avatarColor: '#34495A' },
  { id: 'u-care', name: 'Виктория Сыдыкова', role: 'care_manager', email: 'sydykova@inhouse.kg', phone: '996700100120', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#B93A2F' },
  { id: 'u-acc', name: 'Елена Волкова', role: 'accountant', email: 'volkova@inhouse.kg', phone: '996700100130', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#2F7D5C' },
  { id: 'u-cashier', name: 'Салтанат Джумабекова', role: 'cashier', email: 'jumabekova@inhouse.kg', phone: '996700100131', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#6E4453' },
  { id: 'u-lawyer', name: 'Марат Бекболотов', role: 'lawyer', email: 'bekbolotov@inhouse.kg', phone: '996700100140', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#3A6EA5' },
  { id: 'u-controller', name: 'Асель Орозова', role: 'controller', email: 'orozova@inhouse.kg', phone: '996700100141', projectIds: ['aurora', 'panorama'], active: true, avatarColor: '#B8780E' },
  { id: 'u-agent-1', name: 'Нурбек Токтосунов', role: 'agent', email: 'agent1@partner.kg', phone: '996700100150', projectIds: ['aurora'], active: true, avatarColor: '#8A8A8A' },
]

export const PROMOTIONS: Promotion[] = [
  { id: 'promo-1', name: 'Скидка при 100% оплате', scope: 'unit_kind', value: 5, isPercent: true, active: true, public: true, projectIds: ['aurora', 'panorama'] },
  { id: 'promo-2', name: 'Осенняя рассрочка без %', scope: 'block', value: 0, isPercent: false, active: true, public: true, projectIds: ['aurora'] },
  { id: 'promo-3', name: 'Паркинг в подарок при покупке 3-комнатной', scope: 'unit_type', value: 100, isPercent: true, active: true, public: false, projectIds: ['aurora'] },
  { id: 'promo-4', name: 'Скидка сотрудникам партнёров', scope: 'units', value: 3, isPercent: true, active: false, public: false, projectIds: ['aurora', 'panorama'] },
]

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm-full', name: '100% оплата', kind: 'full', active: true, public: true, affectsPrice: true, projectIds: ['aurora', 'panorama'] },
  { id: 'pm-installment', name: 'Рассрочка от застройщика', kind: 'installment', active: true, public: true, affectsPrice: false, projectIds: ['aurora', 'panorama'] },
  { id: 'pm-mortgage', name: 'Ипотека (Доскредобанк)', kind: 'mortgage', active: true, public: true, affectsPrice: false, projectIds: ['aurora'] },
  { id: 'pm-mortgage-2', name: 'Ипотека (РСК Банк)', kind: 'mortgage', active: false, public: false, affectsPrice: false, projectIds: ['aurora'] },
]

export const UNIT_OPTIONS: UnitOption[] = [
  { id: 'opt-storage', name: 'Кладовая', price: 1800, active: true, projectIds: ['aurora', 'panorama'] },
  { id: 'opt-parking', name: 'Машиноместо (подземное)', price: 6500, active: true, projectIds: ['aurora'] },
  { id: 'opt-finish', name: 'Чистовая отделка «под ключ»', price: 180, active: true, projectIds: ['aurora', 'panorama'] },
  { id: 'opt-furniture', name: 'Меблировка кухни', price: 950, active: false, projectIds: ['aurora'] },
]

export const DOC_TEMPLATES: DocumentTemplate[] = [
  { id: 't1', name: 'Договор купли-продажи в рассрочку', process: 'Договор', source: 'Google Документы', numberFormat: 'Д-{год}-{номер:4}', active: true, updatedAt: '2026-09-10' },
  { id: 't2', name: 'Договор 100% оплаты', process: 'Договор', source: 'Google Документы', numberFormat: 'ДП-{год}-{номер:4}', active: true, updatedAt: '2026-08-22' },
  { id: 't3', name: 'Приходный кассовый ордер (ПКО)', process: 'Платёж', source: 'Google Документы', numberFormat: 'ПКО-{номер:5}', active: true, updatedAt: '2026-09-01' },
  { id: 't4', name: 'Акт приёма-передачи', process: 'Ключи', source: 'LibreOffice', numberFormat: 'АПП-{год}-{номер:3}', active: true, updatedAt: '2026-06-14' },
  { id: 't5', name: 'Дополнительное соглашение о переносе срока', process: 'Допсоглашение', source: 'Google Документы', numberFormat: 'ДС-{год}-{номер:3}', active: false, updatedAt: '2026-04-02' },
  { id: 't6', name: 'Коммерческое предложение', process: 'КП', source: 'Google Документы', numberFormat: 'КП-{номер:5}', active: true, updatedAt: '2026-09-18' },
  { id: 't7', name: 'Справка о полной оплате', process: 'Справка', source: 'LibreOffice', numberFormat: 'СПР-{год}-{номер:3}', active: true, updatedAt: '2026-05-30' },
]

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { group: 'Документ', name: 'Номер документа', code: 'doc.number', hint: 'Формируется по нумератору процесса' },
  { group: 'Документ', name: 'Дата документа', code: 'doc.date', hint: 'Дата формирования, {rod:doc.date} — в родительном падеже' },
  { group: 'Отдел продаж', name: 'Название офиса продаж', code: 'office.name', hint: '' },
  { group: 'Отдел продаж', name: 'Менеджер (ФИО)', code: 'manager.fio', hint: '{short:manager.fio} — сокращённо, И.И. Иванов' },
  { group: 'Покупатель', name: 'ФИО покупателя', code: 'client.fio', hint: '{rod:client.fio} — в родительном падеже' },
  { group: 'Покупатель', name: 'Телефон покупателя', code: 'client.phone', hint: '' },
  { group: 'Покупатель', name: 'Паспорт покупателя', code: 'client.passport', hint: 'Серия, номер, кем и когда выдан' },
  { group: 'Покупатель', name: 'Адрес регистрации', code: 'client.address', hint: '' },
  { group: 'Представитель покупателя', name: 'ФИО представителя', code: 'client.rep.fio', hint: 'Доступно, если указана доверенность' },
  { group: 'Представитель покупателя', name: 'Реквизиты доверенности', code: 'client.rep.poa', hint: '' },
  { group: 'Объект', name: 'Название ЖК', code: 'project.name', hint: '' },
  { group: 'Объект', name: 'Адрес ЖК', code: 'project.address', hint: '' },
  { group: 'Дом', name: 'Номер дома', code: 'building.name', hint: '' },
  { group: 'Дом', name: 'Срок сдачи', code: 'building.deliveryDate', hint: '{month:building.deliveryDate} — месяц словом' },
  { group: 'Помещение', name: 'Номер помещения', code: 'unit.number', hint: '' },
  { group: 'Помещение', name: 'Площадь', code: 'unit.area', hint: 'м²' },
  { group: 'Помещение', name: 'Этаж', code: 'unit.floor', hint: '' },
  { group: 'Помещение', name: 'Количество комнат', code: 'unit.rooms', hint: '' },
  { group: 'Опции', name: 'Список опций', code: 'options.list', hint: '[repeat:options] — повтор по каждой опции' },
  { group: 'Способ оплаты', name: 'Название способа оплаты', code: 'payment_method.name', hint: '' },
  { group: 'Условия 100% оплаты', name: 'Срок оплаты', code: 'full.deadline', hint: '' },
  { group: 'Условия ипотеки', name: 'Банк', code: 'mortgage.bank', hint: '' },
  { group: 'Условия ипотеки', name: 'Сумма кредита', code: 'mortgage.amount', hint: '{sum:mortgage.amount} — прописью' },
  { group: 'Платежи', name: 'Итоговая цена', code: 'contract.price', hint: '{sum:contract.price} — прописью' },
  { group: 'Платежи', name: 'Первоначальный взнос', code: 'contract.downPayment', hint: '' },
  { group: 'Рассрочка', name: 'Срок рассрочки (мес.)', code: 'installment.months', hint: '' },
  { group: 'Рассрочка', name: 'Ежемесячный платёж', code: 'installment.monthly', hint: '{sum:installment.monthly} — прописью' },
  { group: 'Сделка CRM', name: 'Номер сделки amoCRM', code: 'crm.dealId', hint: '' },
  { group: 'График платежей', name: 'Таблица графика', code: 'schedule.table', hint: '[repeat:schedule] — строки графика' },
]

export const TEMPLATE_VAR_GROUPS = [...new Set(TEMPLATE_VARIABLES.map((v) => v.group))]
