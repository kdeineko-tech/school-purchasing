## MODIFIED Requirements

### Requirement: Нові статуси зрізу 3 англійською текстом

The system SHALL підписувати статуси «Частково схвалено» й «Повернено на доопрацювання» у списку й на сторінці заявки
текстом «Partially approved» і «Returned for revision», а не лише кольором; в історії — так само, коли в ній з'являться
записи рішень (після WS9).

#### Scenario: AC-LANG-09 Статуси «Partially approved» і «Returned for revision»

- **GIVEN** заявка зі статусом «Частково схвалено» чи «Повернено на доопрацювання»
- **WHEN** її показано у списку, на сторінці заявки або в історії
- **THEN** статус підписано текстом «Partially approved» чи «Returned for revision» відповідно, а не лише кольором
